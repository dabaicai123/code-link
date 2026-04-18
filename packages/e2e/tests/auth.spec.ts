// packages/e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { createTestDb, seedTestUser, closeTestDb } from '../helpers/test-db';
import { startTestServer, stopTestServer } from '../helpers/test-server';
import type Database from 'better-sqlite3';

let testServer: Awaited<ReturnType<typeof startTestServer>> | null = null;
let testDb: { sqlite: Database.Database; db: any } | null = null;

// 认证测试不使用共享的认证状态，每个测试独立设置
test.beforeAll(async () => {
  testDb = createTestDb();
  testServer = await startTestServer(testDb.sqlite);
});

test.afterAll(async () => {
  if (testServer) {
    await stopTestServer(testServer);
  }
  if (testDb) {
    closeTestDb(testDb.sqlite);
  }
});

test.describe('认证流程', () => {
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

  test('注册成功', async ({ page }) => {
    // 监听 API 请求，mock 后端
    await page.route('**/api/auth/register', async (route) => {
      const body = route.request().postDataJSON();

      // 模拟注册成功响应
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'test-token',
            user: {
              id: 1,
              name: body.name,
              email: body.email,
            },
          },
        }),
      });
    });

    // 访问注册页面
    await page.goto(`${webBaseUrl}/register`);

    // 填写注册表单
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[placeholder="用户名"]', 'NewUser');
    await page.fill('input[type="password"]', 'password123');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待跳转到 dashboard
    await page.waitForURL('**/dashboard');
  });

  test('注册失败 - 邮箱已存在', async ({ page }) => {
    // 先创建一个用户
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testDb!.sqlite);
    await seedTestUser(db, { email: 'existing@example.com' });

    // 访问注册页面
    await page.goto(`${webBaseUrl}/register`);

    // 使用已存在的邮箱注册
    await page.fill('input[type="email"]', 'existing@example.com');
    await page.fill('input[placeholder="用户名"]', 'TestUser');
    await page.fill('input[type="password"]', 'password123');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待错误提示出现
    await expect(page.locator('text=该邮箱已被注册')).toBeVisible({ timeout: 10000 });
  });

  test('登录成功', async ({ page }) => {
    // 先创建测试用户
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testDb!.sqlite);
    const testUser = await seedTestUser(db, { email: 'login@example.com', password: 'testpassword' });

    // 访问登录页面
    await page.goto(`${webBaseUrl}/login`);

    // 填写登录表单
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待跳转到 dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('登录失败 - 错误密码', async ({ page }) => {
    // 先创建测试用户
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testDb!.sqlite);
    await seedTestUser(db, { email: 'wrongpass@example.com', password: 'correctpassword' });

    // 访问登录页面
    await page.goto(`${webBaseUrl}/login`);

    // 使用错误密码登录
    await page.fill('input[type="email"]', 'wrongpass@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待错误提示出现
    await expect(page.locator('text=认证失败')).toBeVisible({ timeout: 10000 });
  });

  test('登出', async ({ page }) => {
    // 先创建测试用户并登录
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testDb!.sqlite);
    const testUser = await seedTestUser(db, { email: 'logout@example.com', password: 'testpassword' });

    // 登录
    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 点击登出按钮（根据实际 UI 定位）
    // 假设侧边栏有登出按钮
    await page.click('text=登出');

    // 等待跳转到登录页
    await page.waitForURL('**/login');
  });

  test('未认证访问保护', async ({ page }) => {
    // 未登录状态访问 dashboard
    await page.goto(`${webBaseUrl}/dashboard`);

    // 应该重定向到登录页
    await page.waitForURL('**/login', { timeout: 10000 });
  });
});