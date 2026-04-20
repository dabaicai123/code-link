import { test as base } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { createDrizzleFromSqlite, seedTestUser, TestUser, DrizzleDb } from '../helpers/test-db';
import type { E2EServerInstance } from '@code-link/server/dist/index.js';

const TEST_JWT_SECRET = 'e2e-test-secret-key-minimum-32-chars-long';

export interface E2EFixtures {
  testServer: E2EServerInstance;
  testUser: TestUser;
  testDb: DrizzleDb;
  webBaseUrl: string;
}

let globalServer: E2EServerInstance | null = null;

async function getOrStartServer(): Promise<E2EServerInstance> {
  if (!globalServer) {
    const { startServerForE2E } = await import('@code-link/server/dist/index.js');
    globalServer = await startServerForE2E();
  }
  return globalServer;
}

function generateTestToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

function generateExpiredToken(userId: number): string {
  return jwt.sign({ userId, exp: Math.floor(Date.now() / 1000) - 1 }, TEST_JWT_SECRET);
}

async function setupApiProxy(page: import('@playwright/test').Page, serverBaseUrl: string) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const apiPath = url.replace(/^.*\/api/, `${serverBaseUrl}/api`);

    const originalHeaders = route.request().headers();
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(originalHeaders)) {
      if (['content-type', 'authorization', 'accept'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    try {
      const response = await fetch(apiPath, {
        method: route.request().method(),
        headers,
        body: route.request().postData(),
      });
      const body = await response.text();
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      });
    } catch {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: '测试服务器不可达' }),
      });
    }
  });
}

export const test = base.extend<E2EFixtures>({
  testServer: async ({}, use) => {
    await use(await getOrStartServer());
  },

  testDb: async ({ testServer }, use) => {
    await use(createDrizzleFromSqlite(testServer.sqlite));
  },

  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
  },

  testUser: async ({ page, context, testServer, testDb }, use) => {
    const user = await seedTestUser(testDb);

    await setupApiProxy(page, testServer.baseUrl);

    await context.addInitScript((tokenValue) => {
      localStorage.setItem('token', tokenValue);
    }, generateTestToken(user.id));

    await use(user);
  },
});

export const authTest = base.extend<E2EFixtures>({
  testServer: async ({}, use) => {
    await use(await getOrStartServer());
  },

  testDb: async ({ testServer }, use) => {
    await use(createDrizzleFromSqlite(testServer.sqlite));
  },

  testUser: async ({ testServer, testDb }, use) => {
    const user = await seedTestUser(testDb);
    await use(user);
  },

  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
  },
});

export async function cleanupGlobalResources() {
  if (globalServer) {
    await globalServer.close();
    globalServer = null;
  }
}

export { setupApiProxy, generateTestToken, generateExpiredToken };
export { expect } from '@playwright/test';
