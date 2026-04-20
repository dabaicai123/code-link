// packages/e2e/tests/support/fixtures.ts
import { test as base, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { TestDatabase } from './database';
import { TestApp } from './test-app';
import { TestApi } from './test-api';
import type { E2EServerInstance, E2EFixtures } from './types';

const TEST_JWT_SECRET = 'e2e-test-secret-key-minimum-32-chars-long';

// Global server instance (singleton)
let globalServer: E2EServerInstance | null = null;

async function getOrStartServer(): Promise<E2EServerInstance> {
  if (!globalServer) {
    // 设置环境变量 BEFORE importing server modules
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:';
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const { startServerForE2E } = await import('@code-link/server/dist/index.js');
    globalServer = await startServerForE2E();
  }
  return globalServer;
}

/**
 * Generate a test JWT token for a user
 */
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Generate an expired JWT token for testing token expiration
 */
export function generateExpiredToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '-1s' });
}

/**
 * Setup API proxy to route frontend requests to test server
 */
async function setupApiProxy(
  page: import('@playwright/test').Page,
  serverBaseUrl: string
): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const apiPath = url.replace(/^.*\/api/, `${serverBaseUrl}/api`);

    const originalHeaders = route.request().headers();
    const headers: Record<string, string> = {};

    // Forward only necessary headers
    for (const [key, value] of Object.entries(originalHeaders)) {
      const lowerKey = key.toLowerCase();
      if (['content-type', 'authorization', 'accept'].includes(lowerKey)) {
        headers[key] = value;
      }
    }

    try {
      const response = await fetch(apiPath, {
        method: route.request().method(),
        headers,
        body: route.request().postData() || undefined,
      });

      const responseBody = await response.text();

      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      });
    } catch (error) {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Test server unreachable' }),
      });
    }
  });
}

/**
 * Main test fixture with all E2E support
 */
export const test = base.extend<E2EFixtures>({
  // Server instance (shared across tests)
  server: async ({}, use) => {
    const server = await getOrStartServer();
    await use(server);
  },

  // Database with snapshot support
  db: async ({ server }, use) => {
    const db = new TestDatabase(server.sqlite);
    db.clean();
    db.checkpoint('initial');

    await use(db);

    // Always rollback to initial state after test
    db.rollback('initial');
  },

  // API client
  api: async ({ server }, use) => {
    const api = new TestApi(server.baseUrl);
    await use(api);
  },

  // Test application controller
  app: async ({ page, db, api, server }, use) => {
    // Setup API proxy before each test
    await setupApiProxy(page, server.baseUrl);

    const app = new TestApp(page, db, api);
    await use(app);
  },
});

/**
 * Auth-specific test fixture (no pre-authenticated state)
 */
export const authTest = base.extend<E2EFixtures>({
  server: async ({}, use) => {
    const server = await getOrStartServer();
    await use(server);
  },

  db: async ({ server }, use) => {
    const db = new TestDatabase(server.sqlite);
    db.clean();
    db.checkpoint('initial');
    await use(db);
    db.rollback('initial');
  },

  api: async ({ server }, use) => {
    const api = new TestApi(server.baseUrl);
    await use(api);
  },

  app: async ({ page, db, api, server }, use) => {
    await setupApiProxy(page, server.baseUrl);
    const app = new TestApp(page, db, api);
    await use(app);
  },
});

// Re-export expect for convenience
export { expect };

/**
 * Cleanup global resources (call in global teardown)
 */
export async function cleanupGlobalResources(): Promise<void> {
  if (globalServer) {
    await globalServer.close();
    globalServer = null;
  }
}
