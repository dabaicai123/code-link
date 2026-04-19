// packages/e2e/tests/auth.spec.ts
import { authTest as test, expect } from '../fixtures/base';
import { seedTestUser } from '../helpers/test-db';
import { generateExpiredToken } from '../helpers/test-server';
import { drizzle } from 'drizzle-orm/better-sqlite3';

// 使用 authTest fixture，共享全局服务器
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

test.describe('认证流程', () => {
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

  // 为每个测试设置 API 路由
  test.beforeEach(async ({ page, testServer }) => {
    await setupApiRoutes(page, testServer.baseUrl);
  });

  test('注册成功', async ({ page }) => {
    // 覆盖注册 API 的默认行为
    await page.route('**/api/auth/register', async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'test-token',
            user: { id: 1, name: body.name, email: body.email },
          },
        }),
      });
    }, { times: 1 });

    await page.goto(`${webBaseUrl}/register`);
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[placeholder="用户名"]', 'NewUser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('注册失败 - 邮箱已存在', async ({ page, testServer }) => {
    const db = drizzle(testServer.db);
    await seedTestUser(db, { email: 'existing@example.com' });

    await page.goto(`${webBaseUrl}/register`);
    await page.fill('input[type="email"]', 'existing@example.com');
    await page.fill('input[placeholder="用户名"]', 'TestUser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=该邮箱已被注册')).toBeVisible();
  });

  test('登录成功', async ({ page, testServer }) => {
    const db = drizzle(testServer.db);
    const testUser = await seedTestUser(db, { email: 'login@example.com', password: 'testpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('登录失败 - 错误密码', async ({ page, testServer }) => {
    const db = drizzle(testServer.db);
    await seedTestUser(db, { email: 'wrongpass@example.com', password: 'correctpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', 'wrongpass@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=认证失败')).toBeVisible();
  });

  test('登录失败 - 用户不存在', async ({ page }) => {
    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=认证失败')).toBeVisible();
  });

  test('未认证访问保护', async ({ page }) => {
    await page.goto(`${webBaseUrl}/dashboard`);
    await page.waitForURL('**/login');
  });

  test('Token 过期处理', async ({ page, testServer }) => {
    const db = drizzle(testServer.db);
    const testUser = await seedTestUser(db, { email: 'expired@example.com', password: 'testpassword' });
    const expiredToken = generateExpiredToken(testUser.id);

    await page.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, expiredToken);

    await page.goto(`${webBaseUrl}/dashboard`);
    await page.waitForURL('**/login');
  });

  test('记住登录状态 - 页面刷新后保持登录', async ({ page, testServer }) => {
    const db = drizzle(testServer.db);
    const testUser = await seedTestUser(db, { email: 'remember@example.com', password: 'testpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.reload();
    await expect(page).toHaveURL(/.*dashboard.*/);
  });

  test('多标签页登录状态同步', async ({ page, context, testServer }) => {
    const db = drizzle(testServer.db);
    const testUser = await seedTestUser(db, { email: 'multitab@example.com', password: 'testpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const newPage = await context.newPage();
    await setupApiRoutes(newPage, testServer.baseUrl);
    await newPage.goto(`${webBaseUrl}/dashboard`);
    await expect(newPage).toHaveURL(/.*dashboard.*/);
    await newPage.close();
  });

  test('并发登录同一账户', async ({ browser, testServer }) => {
    const db = drizzle(testServer.db);
    const testUser = await seedTestUser(db, { email: 'concurrent@example.com', password: 'testpassword' });

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await setupApiRoutes(page1, testServer.baseUrl);
    await setupApiRoutes(page2, testServer.baseUrl);

    try {
      const login1 = (async () => {
        await page1.goto(`${webBaseUrl}/login`);
        await page1.fill('input[type="email"]', testUser.email);
        await page1.fill('input[type="password"]', testUser.password);
        await page1.click('button[type="submit"]');
        await page1.waitForURL('**/dashboard');
      })();

      const login2 = (async () => {
        await page2.goto(`${webBaseUrl}/login`);
        await page2.fill('input[type="email"]', testUser.email);
        await page2.fill('input[type="password"]', testUser.password);
        await page2.click('button[type="submit"]');
        await page2.waitForURL('**/dashboard');
      })();

      await Promise.all([login1, login2]);
      await expect(page1).toHaveURL(/.*dashboard.*/);
      await expect(page2).toHaveURL(/.*dashboard.*/);
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
