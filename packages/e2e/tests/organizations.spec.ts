// packages/e2e/tests/organizations.spec.ts
import { test, expect } from '../fixtures/base';
import { generateTestToken } from '../helpers/test-server';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedTestOrganization, seedTestUser, seedTestProject, seedTestInvitation } from '../helpers/test-db';

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

  test.describe('组织列表', () => {
    test('空组织列表显示', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/organizations`);
      await page.waitForLoadState('networkidle');

      // 验证空状态显示
      await expect(page.locator('text=创建组织')).toBeVisible({ timeout: 10000 });
    });

    test('显示多个组织', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      await seedTestOrganization(db, testUser.id, 'First Organization');
      await seedTestOrganization(db, testUser.id, 'Second Organization');

      await page.goto(`${webBaseUrl}/organizations`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=First Organization')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Second Organization')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('组织创建', () => {
    test('创建新组织', async ({ page, webBaseUrl }) => {
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

    test('空名称验证', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/organizations`);
      await page.waitForLoadState('networkidle');

      // 点击创建组织按钮
      await page.click('text=创建组织');

      // 不填写名称直接提交
      await page.click('button:has-text("创建")');

      // 验证错误提示
      await expect(page.locator('text=缺少组织名称')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('组织详情', () => {
    test('组织详情页显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Detail Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Detail Test Org')).toBeVisible({ timeout: 10000 });
    });

    test('成员列表显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Member Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 验证创建者在成员列表中
      await expect(page.locator(`text=${testUser.name}`)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('邀请成员', () => {
    test('发送邀请', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Invite Test Org');

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

    test('重复邮箱邀请', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Duplicate Invite Org');
      // 预先创建一个待处理邀请
      await seedTestInvitation(db, orgId, testUser.id, { email: 'existing@example.com' });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 点击邀请按钮
      await page.click('text=邀请成员');

      // 填写已存在的邮箱
      await page.fill('input[type="email"]', 'existing@example.com');

      // 提交邀请
      await page.click('button:has-text("发送邀请")');

      // 验证错误提示
      await expect(page.locator('text=已有待处理的邀请')).toBeVisible({ timeout: 5000 });
    });

    test('邀请列表显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Invitation List Org');
      await seedTestInvitation(db, orgId, testUser.id, { email: 'invited1@example.com' });
      await seedTestInvitation(db, orgId, testUser.id, { email: 'invited2@example.com' });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 验证邀请列表显示（根据实际 UI 调整选择器）
      await expect(page.locator('text=invited1@example.com')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=invited2@example.com')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('成员角色管理', () => {
    test('更新成员角色', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Role Update Org');
      // 创建另一个用户并添加为成员
      const anotherUser = await seedTestUser(db, { email: 'member@example.com', name: 'Member User' });
      // 直接插入成员记录
      const { organizationMembers } = await import('@code-link/server/dist/db/schema/index.js');
      await db.insert(organizationMembers).values({
        organizationId: orgId,
        userId: anotherUser.id,
        role: 'member',
        invitedBy: testUser.id,
      });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 找到成员并更新角色（根据实际 UI 调整）
      // 这里假设有角色选择器或更新按钮
      const memberRow = page.locator('text=Member User').first();
      await memberRow.click();

      // 选择新角色
      await page.click('text=developer');

      // 验证角色更新成功
      await expect(page.locator('text=developer')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('组织删除', () => {
    test('删除组织', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Delete Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 点击删除按钮
      await page.click('text=删除组织');

      // 确认删除
      await page.click('button:has-text("确认")');

      // 验证返回列表页
      await expect(page).toHaveURL(/\/organizations$/, { timeout: 10000 });

      // 验证组织不再显示
      await expect(page.locator('text=Delete Test Org')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('仓库列表', () => {
    test('组织下项目显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Project List Org');
      await seedTestProject(db, testUser.id, orgId, { name: 'Project Under Org' });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 验证项目显示
      await expect(page.locator('text=Project Under Org')).toBeVisible({ timeout: 10000 });
    });

    test('空项目列表', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Empty Project Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.waitForLoadState('networkidle');

      // 验证空状态
      await expect(page.locator('text=暂无项目')).toBeVisible({ timeout: 10000 });
    });
  });
});
