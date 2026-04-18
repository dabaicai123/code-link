// packages/e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { createTestDb, seedTestUser, closeTestDb } from '../helpers/test-db';
import { startTestServer, stopTestServer, generateTestToken, generateExpiredToken } from '../helpers/test-server';
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
    // 先创建一个用户 - 使用 ORM
    await seedTestUser(testServer!.orm, { email: 'existing@example.com' });

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

  test('注册失败 - 无效邮箱格式', async ({ page }) => {
    // 访问注册页面
    await page.goto(`${webBaseUrl}/register`);

    // 填写无效邮箱格式
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[placeholder="用户名"]', 'TestUser');
    await page.fill('input[type="password"]', 'password123');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待邮箱验证错误提示
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible({ timeout: 10000 });
  });

  test('注册失败 - 密码太短', async ({ page }) => {
    // 访问注册页面
    await page.goto(`${webBaseUrl}/register`);

    // 填写密码太短
    await page.fill('input[type="email"]', 'shortpass@example.com');
    await page.fill('input[placeholder="用户名"]', 'TestUser');
    await page.fill('input[type="password"]', '123');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待密码太短错误提示
    await expect(page.locator('text=密码至少需要')).toBeVisible({ timeout: 10000 });
  });

  test('注册失败 - 必填项为空', async ({ page }) => {
    // 访问注册页面
    await page.goto(`${webBaseUrl}/register`);

    // 不填写任何内容，直接提交
    await page.click('button[type="submit"]');

    // 等待必填项错误提示
    await expect(page.locator('text=请填写')).toBeVisible({ timeout: 10000 });
  });

  test('登录成功', async ({ page }) => {
    // 先创建测试用户 - 使用 ORM
    const testUser = await seedTestUser(testServer!.orm, { email: 'login@example.com', password: 'testpassword' });

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
    // 先创建测试用户 - 使用 ORM
    await seedTestUser(testServer!.orm, { email: 'wrongpass@example.com', password: 'correctpassword' });

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

  test('登录失败 - 用户不存在', async ({ page }) => {
    // 访问登录页面
    await page.goto(`${webBaseUrl}/login`);

    // 使用不存在的用户登录
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'password123');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待错误提示出现
    await expect(page.locator('text=认证失败')).toBeVisible({ timeout: 10000 });
  });

  test('登录失败 - 空凭证', async ({ page }) => {
    // 访问登录页面
    await page.goto(`${webBaseUrl}/login`);

    // 不填写任何内容，直接提交
    await page.click('button[type="submit"]');

    // 等待错误提示出现
    await expect(page.locator('text=请填写')).toBeVisible({ timeout: 10000 });
  });

  test('登出', async ({ page }) => {
    // 先创建测试用户并登录 - 使用 ORM
    const testUser = await seedTestUser(testServer!.orm, { email: 'logout@example.com', password: 'testpassword' });

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

  test('Token 过期处理', async ({ page }) => {
    // 先创建测试用户 - 使用 ORM
    const testUser = await seedTestUser(testServer!.orm, { email: 'expired@example.com', password: 'testpassword' });

    // 生成已过期的 token
    const expiredToken = generateExpiredToken(testUser.id);

    // 设置过期 token 到 localStorage
    await page.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, expiredToken);

    // 访问 dashboard
    await page.goto(`${webBaseUrl}/dashboard`);

    // 应该重定向到登录页（因为 token 过期）
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('GitHub OAuth 登录', async ({ page }) => {
    // Mock GitHub OAuth 回调
    await page.route('**/api/auth/github', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'github-oauth-token',
            user: {
              id: 100,
              name: 'GitHub User',
              email: 'github@example.com',
            },
          },
        }),
      });
    });

    // 访问登录页面
    await page.goto(`${webBaseUrl}/login`);

    // 点击 GitHub 登录按钮
    await page.click('button:has-text("GitHub")');

    // 等待跳转到 dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('GitLab OAuth 登录', async ({ page }) => {
    // Mock GitLab OAuth 回调
    await page.route('**/api/auth/gitlab', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'gitlab-oauth-token',
            user: {
              id: 101,
              name: 'GitLab User',
              email: 'gitlab@example.com',
            },
          },
        }),
      });
    });

    // 访问登录页面
    await page.goto(`${webBaseUrl}/login`);

    // 点击 GitLab 登录按钮
    await page.click('button:has-text("GitLab")');

    // 等待跳转到 dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('记住登录状态 - 页面刷新后保持登录', async ({ page }) => {
    // 先创建测试用户 - 使用 ORM
    const testUser = await seedTestUser(testServer!.orm, { email: 'remember@example.com', password: 'testpassword' });

    // 登录
    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 刷新页面
    await page.reload();

    // 应该仍然在 dashboard 页面
    await expect(page).toHaveURL(/.*dashboard.*/);
  });

  test('多标签页登录状态同步', async ({ page, context }) => {
    // 先创建测试用户 - 使用 ORM
    const testUser = await seedTestUser(testServer!.orm, { email: 'multitab@example.com', password: 'testpassword' });

    // 登录
    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 打开新标签页
    const newPage = await context.newPage();

    // 在新标签页访问 dashboard
    await newPage.goto(`${webBaseUrl}/dashboard`);

    // 新标签页应该能够访问（共享登录状态）
    await expect(newPage).toHaveURL(/.*dashboard.*/);

    // 关闭新标签页
    await newPage.close();
  });

  test('并发登录同一账户', async ({ browser }) => {
    // 先创建测试用户 - 使用 ORM
    const testUser = await seedTestUser(testServer!.orm, { email: 'concurrent@example.com', password: 'testpassword' });

    // 创建两个独立的浏览器上下文
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // 两个上下文同时登录同一账户
      const login1 = (async () => {
        await page1.goto(`${webBaseUrl}/login`);
        await page1.fill('input[type="email"]', testUser.email);
        await page1.fill('input[type="password"]', testUser.password);
        await page1.click('button[type="submit"]');
        await page1.waitForURL('**/dashboard', { timeout: 15000 });
      })();

      const login2 = (async () => {
        await page2.goto(`${webBaseUrl}/login`);
        await page2.fill('input[type="email"]', testUser.email);
        await page2.fill('input[type="password"]', testUser.password);
        await page2.click('button[type="submit"]');
        await page2.waitForURL('**/dashboard', { timeout: 15000 });
      })();

      // 两个登录都应该成功
      await Promise.all([login1, login2]);

      // 验证两个页面都在 dashboard
      await expect(page1).toHaveURL(/.*dashboard.*/);
      await expect(page2).toHaveURL(/.*dashboard.*/);
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
