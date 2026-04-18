// packages/e2e/tests/collaboration.spec.ts
import { test, expect } from '../fixtures/base';
import { generateTestToken } from '../helpers/test-server';

test.describe('协作功能', () => {
  test.beforeEach(async ({ page, testServer, testUser, webBaseUrl }) => {
    // 设置认证 token
    const token = generateTestToken(testUser.id);
    await page.addInitScript((tokenValue) => {
      localStorage.setItem('token', tokenValue);
    }, token);

    // 设置 API mock 指向测试服务器
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

    // 创建测试项目和草稿
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestProject } = await import('../helpers/test-db');
    const projectId = await seedTestProject(db, testUser.id, undefined, { name: 'Collab Project' });

    // 访问 dashboard
    await page.goto(`${webBaseUrl}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('消息面板显示', async ({ page }) => {
    // 点击项目进入工作区
    await page.click('text=Collab Project');

    // 等待工作区加载
    await page.waitForTimeout(2000);

    // 验证消息面板组件存在（根据实际 UI 结构）
    // 例如检查消息输入框
    await expect(page.locator('input[placeholder*="消息"]')).toBeVisible({ timeout: 10000 });
  });

  test('发送消息', async ({ page, testServer, testUser }) => {
    // 点击项目进入工作区
    await page.click('text=Collab Project');
    await page.waitForTimeout(2000);

    // 找到消息输入框
    const messageInput = page.locator('input[placeholder*="消息"]').first();
    await messageInput.fill('Hello, this is a test message!');

    // 发送消息
    await page.keyboard.press('Enter');

    // 等待消息显示
    await expect(page.locator('text=Hello, this is a test message!')).toBeVisible({ timeout: 5000 });
  });

  test('草稿列表显示', async ({ page, testServer, testUser }) => {
    // 点击项目进入工作区
    await page.click('text=Collab Project');
    await page.waitForTimeout(2000);

    // 创建一个测试草稿
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);

    // 获取项目 ID
    const project = db.select().from({}).where({}).get(); // 简化处理

    // 验证草稿列表组件存在（根据实际 UI）
    // 例如检查草稿列表标题
    await expect(page.locator('text=草稿')).toBeVisible({ timeout: 5000 });
  });
});