// packages/e2e/tests/organizations.spec.ts
import { test, expect } from '../fixtures/base';
import { generateTestToken } from '../helpers/test-server';

test.describe('组织管理', () => {
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
  });

  test('查看组织列表', async ({ page, webBaseUrl, testServer, testUser }) => {
    // 创建测试组织
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestOrganization } = await import('../helpers/test-db');
    await seedTestOrganization(db, testUser.id, 'Test Organization');

    // 访问组织页面
    await page.goto(`${webBaseUrl}/organizations`);
    await page.waitForLoadState('networkidle');

    // 验证组织列表显示
    await expect(page.locator('text=Test Organization')).toBeVisible({ timeout: 10000 });
  });

  test('创建新组织', async ({ page, webBaseUrl }) => {
    // 访问组织页面
    await page.goto(`${webBaseUrl}/organizations`);
    await page.waitForLoadState('networkidle');

    // 点击创建组织按钮
    await page.click('text=创建组织');

    // 填写组织名称
    await page.fill('input[placeholder="组织名称"]', 'New Organization');

    // 提交创建
    await page.click('button:has-text("创建")');

    // 等待组织创建成功
    await expect(page.locator('text=New Organization')).toBeVisible({ timeout: 10000 });
  });

  test('组织详情页', async ({ page, webBaseUrl, testServer, testUser }) => {
    // 创建测试组织
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestOrganization } = await import('../helpers/test-db');
    const orgId = await seedTestOrganization(db, testUser.id, 'Detail Test Org');

    // 访问组织详情页
    await page.goto(`${webBaseUrl}/organizations/${orgId}`);
    await page.waitForLoadState('networkidle');

    // 验证组织名称显示
    await expect(page.locator('text=Detail Test Org')).toBeVisible({ timeout: 10000 });
  });

  test('邀请成员', async ({ page, webBaseUrl, testServer, testUser }) => {
    // 创建测试组织
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestOrganization } = await import('../helpers/test-db');
    const orgId = await seedTestOrganization(db, testUser.id, 'Invite Test Org');

    // 访问组织详情页
    await page.goto(`${webBaseUrl}/organizations/${orgId}`);
    await page.waitForLoadState('networkidle');

    // 点击邀请按钮
    await page.click('text=邀请成员');

    // 填写邮箱
    await page.fill('input[type="email"]', 'invitee@example.com');

    // 提交邀请
    await page.click('button:has-text("发送邀请")');

    // 验证邀请成功提示
    await expect(page.locator('text=邀请已发送')).toBeVisible({ timeout: 5000 });
  });

  test('查看仓库列表', async ({ page, webBaseUrl, testServer, testUser }) => {
    // 创建测试组织和项目
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestOrganization, seedTestProject } = await import('../helpers/test-db');
    const orgId = await seedTestOrganization(db, testUser.id, 'Repo Test Org');
    await seedTestProject(db, testUser.id, orgId, { name: 'Repo Test Project' });

    // 访问组织详情页
    await page.goto(`${webBaseUrl}/organizations/${orgId}`);
    await page.waitForLoadState('networkidle');

    // 验证仓库列表区域存在（根据实际 UI）
    await expect(page.locator('text=仓库')).toBeVisible({ timeout: 10000 });
  });
});