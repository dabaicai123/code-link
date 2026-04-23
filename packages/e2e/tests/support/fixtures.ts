// packages/e2e/tests/support/fixtures.ts
import { test as base, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { TestApp } from './test-app';
import { TestApi } from './test-api';

const TEST_JWT_SECRET = process.env.JWT_SECRET!;
if (!TEST_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in .env for e2e tests');
}

// Server runs on port 4000 (started externally via ./scripts/start-e2e.sh)
const BACKEND_URL = 'http://localhost:4000';

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

// Simplified fixtures without database snapshots
interface SimpleFixtures {
  api: TestApi;
  app: TestApp;
}

/**
 * Main test fixture with all E2E support
 */
export const test = base.extend<SimpleFixtures>({
  // API client
  api: async ({}, use) => {
    const api = new TestApi(BACKEND_URL);
    await use(api);
  },

  // Test application controller
  app: async ({ page, api }, use) => {
    const app = new TestApp(page, api);
    await use(app);
  },
});

/**
 * Auth-specific test fixture (no pre-authenticated state)
 */
export const authTest = base.extend<SimpleFixtures>({
  api: async ({}, use) => {
    const api = new TestApi(BACKEND_URL);
    await use(api);
  },

  app: async ({ page, api }, use) => {
    const app = new TestApp(page, api);
    await use(app);
  },
});

// Re-export expect for convenience
export { expect };
