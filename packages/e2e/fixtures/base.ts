// packages/e2e/fixtures/base.ts
import { test as base, Page, BrowserContext } from '@playwright/test';
import Database from 'better-sqlite3';
import { createTestDb, seedTestUser, TestUser, closeTestDb } from '../helpers/test-db';
import { startTestServer, stopTestServer, TestServer, generateTestToken } from '../helpers/test-server';

export interface E2EFixtures {
  // 测试服务器
  testServer: TestServer;
  // 测试用户（已认证状态）
  testUser: TestUser;
  // 前端基础 URL
  webBaseUrl: string;
}

// 全局测试服务器实例（测试间共享）
let globalTestServer: TestServer | null = null;
let globalTestDb: { sqlite: Database.Database; db: any } | null = null;

export const test = base.extend<E2EFixtures>({
  // 测试服务器 fixture - 先初始化
  testServer: async ({}, use) => {
    if (!globalTestServer) {
      globalTestDb = createTestDb();
      globalTestServer = await startTestServer(globalTestDb.sqlite);
    }
    await use(globalTestServer);
  },

  // 前端基础 URL
  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
  },

  // 测试用户 fixture - 自动设置认证和 API 路由
  testUser: async ({ page, context, testServer }, use) => {
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const user = await seedTestUser(db);

    // 设置 API 路由转发（必须在 token 设置之前）
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const apiPath = url.replace(/^.*\/api/, `${testServer.baseUrl}/api`);

      // 获取原始 headers，但过滤掉 Playwright 添加的 headers
      const originalHeaders = route.request().headers();
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(originalHeaders)) {
        // 只保留必要的 headers
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
      } catch (error) {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: '测试服务器不可达' }),
        });
      }
    });

    // 设置认证 token（在所有页面创建之前）
    await context.addInitScript((tokenValue) => {
      localStorage.setItem('token', tokenValue);
    }, generateTestToken(user.id));

    await use(user);
  },
});

// 认证测试使用的基础 test（不复用认证状态，但共享服务器）
export const authTest = base.extend<E2EFixtures>({
  testServer: async ({}, use) => {
    if (!globalTestServer) {
      globalTestDb = createTestDb();
      globalTestServer = await startTestServer(globalTestDb.sqlite);
    }
    await use(globalTestServer);
  },

  testUser: async ({ testServer }, use) => {
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const user = await seedTestUser(db);
    await use(user);
  },

  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
  },
});

// 清理全局资源
export async function cleanupGlobalResources() {
  if (globalTestServer) {
    await stopTestServer(globalTestServer);
    globalTestServer = null;
  }
  if (globalTestDb) {
    closeTestDb(globalTestDb.sqlite);
    globalTestDb = null;
  }
}

// 导出 expect
export { expect } from '@playwright/test';