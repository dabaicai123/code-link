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

// 设置 API 路由转发到测试服务器
async function setupApiRoutes(page: Page, testServer: TestServer) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const apiPath = url.replace(/^.*\/api/, `${testServer.baseUrl}/api`);
    const response = await fetch(apiPath, {
      method: route.request().method(),
      headers: route.request().headers(),
      body: route.request().postData(),
    });
    const body = await response.text();
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    });
  });
}

export const test = base.extend<E2EFixtures>({
  // 测试服务器 fixture
  testServer: async ({}, use) => {
    // 如果已存在全局服务器，复用它
    if (!globalTestServer) {
      // 创建测试数据库
      globalTestDb = createTestDb();
      // 启动测试服务器
      globalTestServer = await startTestServer(globalTestDb.sqlite);
    }
    await use(globalTestServer);
  },

  // 测试用户 fixture - 自动设置认证和 API 路由
  testUser: async ({ page, testServer }, use) => {
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const user = await seedTestUser(db);

    // 设置认证 token
    const token = generateTestToken(user.id);
    await page.addInitScript((tokenValue) => {
      localStorage.setItem('token', tokenValue);
    }, token);

    // 设置 API 路由转发
    await setupApiRoutes(page, testServer);

    await use(user);
  },

  // 前端基础 URL（默认本地开发服务器）
  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
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

// 辅助函数：创建已认证的浏览器上下文
export async function createAuthenticatedContext(
  browser: any,
  testServer: TestServer,
  user: TestUser
): Promise<{ context: BrowserContext; page: Page }> {
  const token = generateTestToken(user.id);
  const context = await browser.newContext();
  const page = await context.newPage();

  // 设置 token 到 localStorage
  await page.addInitScript((tokenValue) => {
    localStorage.setItem('token', tokenValue);
  }, token);

  return { context, page };
}

// 辅助函数：登录用户
export async function loginAsUser(
  page: Page,
  webBaseUrl: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${webBaseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // 等待跳转到 dashboard
  await page.waitForURL('**/dashboard');
}