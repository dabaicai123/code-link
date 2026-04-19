// packages/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import { createTestDb, seedTestUser } from './helpers/test-db';
import { startTestServer, generateTestToken } from './helpers/test-server';
import Database from 'better-sqlite3';

let testServer: Awaited<ReturnType<typeof startTestServer>> | null = null;
let testDb: { sqlite: Database.Database; db: any } | null = null;

// 设置 API 路由转发到测试服务器
async function setupApiRoutes(page: import('@playwright/test').Page, baseUrl: string) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const apiPath = url.replace(/^.*\/api/, `${baseUrl}/api`);
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

setup('prepare test environment and authenticate', async ({ browser }) => {
  // 创建测试数据库
  testDb = createTestDb();

  // 启动测试服务器
  testServer = await startTestServer(testDb.sqlite);

  // 创建测试用户
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const db = drizzle(testServer.db);
  const testUser = await seedTestUser(db);

  // 创建已认证的浏览器上下文并保存状态
  const token = generateTestToken(testUser.id);
  const context = await browser.newContext();
  const page = await context.newPage();

  // 设置 API 路由
  await setupApiRoutes(page, testServer.baseUrl);

  // 设置 token 到 localStorage
  await page.addInitScript((tokenValue) => {
    localStorage.setItem('token', tokenValue);
  }, token);

  // 访问前端验证认证状态
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
  await page.goto(`${webBaseUrl}/dashboard`);

  // 等待页面加载
  await page.waitForTimeout(1000);

  // 保存认证状态
  await page.context().storageState({ path: 'playwright/.auth/user.json' });

  // 清理
  await context.close();

  // 环境变量暴露测试服务器地址，供其他测试使用
  process.env.E2E_BASE_URL = testServer.baseUrl;
});