// packages/e2e/tests/organizations.spec.ts
import { test, expect } from '../fixtures/base';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedTestOrganization, seedTestUser, seedTestProject, seedTestInvitation } from '../helpers/test-db';

test.describe('组织管理', () => {
  // 使用 testUser fixture 自动设置的认证和 API 路由

  test.describe('组织列表', () => {
    test('空组织列表显示', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/organizations`);
      await expect(page.locator('text=创建组织')).toBeVisible();
    });

    test('显示多个组织', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      await seedTestOrganization(db, testUser.id, 'First Organization');
      await seedTestOrganization(db, testUser.id, 'Second Organization');

      await page.goto(`${webBaseUrl}/organizations`);
      await expect(page.locator('text=First Organization')).toBeVisible();
      await expect(page.locator('text=Second Organization')).toBeVisible();
    });
  });

  test.describe('组织创建', () => {
    test('创建新组织', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/organizations`);
      await page.click('text=创建组织');
      await page.fill('input[placeholder="组织名称"]', 'New Organization');
      await page.click('button:has-text("创建")');
      await expect(page.locator('text=New Organization')).toBeVisible();
    });

    test('空名称验证', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/organizations`);
      await page.click('text=创建组织');
      await page.click('button:has-text("创建")');
      await expect(page.locator('text=缺少组织名称')).toBeVisible();
    });
  });

  test.describe('组织详情', () => {
    test('组织详情页显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Detail Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await expect(page.locator('text=Detail Test Org')).toBeVisible();
    });

    test('成员列表显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Member Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await expect(page.locator(`text=${testUser.name}`)).toBeVisible();
    });
  });

  test.describe('邀请成员', () => {
    test('发送邀请', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Invite Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.click('text=邀请成员');
      await page.fill('input[type="email"]', 'invitee@example.com');
      await page.click('button:has-text("发送邀请")');
      await expect(page.locator('text=邀请已发送')).toBeVisible();
    });

    test('重复邮箱邀请', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Duplicate Invite Org');
      await seedTestInvitation(db, orgId, testUser.id, { email: 'existing@example.com' });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.click('text=邀请成员');
      await page.fill('input[type="email"]', 'existing@example.com');
      await page.click('button:has-text("发送邀请")');
      await expect(page.locator('text=已有待处理的邀请')).toBeVisible();
    });

    test('邀请列表显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Invitation List Org');
      await seedTestInvitation(db, orgId, testUser.id, { email: 'invited1@example.com' });
      await seedTestInvitation(db, orgId, testUser.id, { email: 'invited2@example.com' });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await expect(page.locator('text=invited1@example.com')).toBeVisible();
      await expect(page.locator('text=invited2@example.com')).toBeVisible();
    });
  });

  test.describe('成员角色管理', () => {
    test('更新成员角色', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Role Update Org');
      const anotherUser = await seedTestUser(db, { email: 'member@example.com', name: 'Member User' });

      const { organizationMembers } = await import('@code-link/server/dist/db/schema/index.js');
      await db.insert(organizationMembers).values({
        organizationId: orgId,
        userId: anotherUser.id,
        role: 'member',
        invitedBy: testUser.id,
      });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      const memberRow = page.locator('text=Member User').first();
      await memberRow.click();
      await page.click('text=developer');
      await expect(page.locator('text=developer')).toBeVisible();
    });
  });

  test.describe('组织删除', () => {
    test('删除组织', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Delete Test Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await page.click('text=删除组织');
      await page.click('button:has-text("确认")');
      await expect(page).toHaveURL(/\/organizations$/);
    });
  });

  test.describe('仓库列表', () => {
    test('组织下项目显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Project List Org');
      await seedTestProject(db, testUser.id, orgId, { name: 'Project Under Org' });

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await expect(page.locator('text=Project Under Org')).toBeVisible();
    });

    test('空项目列表', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Empty Project Org');

      await page.goto(`${webBaseUrl}/organizations/${orgId}`);
      await expect(page.locator('text=暂无项目')).toBeVisible();
    });
  });
});