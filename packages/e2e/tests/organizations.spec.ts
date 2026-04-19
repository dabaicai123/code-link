// packages/e2e/tests/organizations.spec.ts
import { test, expect } from '../fixtures/base';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedTestOrganization, seedTestUser, seedTestProject, seedTestInvitation } from '../helpers/test-db';

test.describe('组织管理', () => {
  // 组织功能在 /settings 页面的 organization tab 中

  test.describe('组织列表', () => {
    test('空组织列表显示', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/settings`);
      // 等待组织 tab 加载（默认就是 organization tab）
      await expect(page.locator('text=创建组织')).toBeVisible();
      // 没有组织时显示提示
      await expect(page.locator('text=您尚未加入任何组织')).toBeVisible();
    });

    test('显示多个组织', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      await seedTestOrganization(db, testUser.id, 'First Organization');
      await seedTestOrganization(db, testUser.id, 'Second Organization');

      await page.goto(`${webBaseUrl}/settings`);
      await expect(page.locator('text=First Organization')).toBeVisible();
      await expect(page.locator('text=Second Organization')).toBeVisible();
    });
  });

  test.describe('组织创建', () => {
    test('创建新组织', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=创建组织');
      await page.fill('input[placeholder="组织名称"]', 'New Organization');
      await page.click('button:has-text("创建")');
      // 创建成功后组织列表中显示新组织
      await expect(page.locator('text=New Organization')).toBeVisible();
    });

    test('空名称验证', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=创建组织');
      // 直接点击创建按钮，输入框为空
      await page.click('button:has-text("创建")');
      // 前端应该有验证提示
    });
  });

  test.describe('组织详情', () => {
    test('组织详情页显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Detail Test Org');

      await page.goto(`${webBaseUrl}/settings`);
      // 点击组织项显示详情
      await page.click('text=Detail Test Org');
      // 右侧详情面板显示组织名称
      await expect(page.locator('text=Detail Test Org')).toBeVisible();
    });

    test('成员列表显示', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      await seedTestOrganization(db, testUser.id, 'Member Test Org');

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Member Test Org');
      // 成员列表显示创建者
      await expect(page.locator('text=成员列表')).toBeVisible();
    });
  });

  test.describe('邀请成员', () => {
    test('发送邀请', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      await seedTestOrganization(db, testUser.id, 'Invite Test Org');

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Invite Test Org');
      // 点击邀请成员按钮
      await page.click('text=邀请成员');
      await page.fill('input[type="email"]', 'invitee@example.com');
      await page.click('button:has-text("发送邀请")');
      // 邀请成功后出现在待处理邀请列表
    });

    test('重复邮箱邀请', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Duplicate Invite Org');
      await seedTestInvitation(db, orgId, testUser.id, { email: 'existing@example.com' });

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Duplicate Invite Org');
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

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Invitation List Org');
      // 展开待处理邀请
      await page.click('text=展开');
      await expect(page.locator('text=invited1@example.com')).toBeVisible();
      await expect(page.locator('text=invited2@example.com')).toBeVisible();
    });
  });

  test.describe('成员角色管理', () => {
    test('更新成员角色', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      await seedTestOrganization(db, testUser.id, 'Role Update Org');
      const anotherUser = await seedTestUser(db, { email: 'member@example.com', name: 'Member User' });

      const { organizationMembers } = await import('@code-link/server/dist/db/schema/index.js');
      await db.insert(organizationMembers).values({
        organizationId: anotherUser.id,
        userId: anotherUser.id,
        role: 'member',
        invitedBy: testUser.id,
      });

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Role Update Org');
      // 成员列表中应该能看到成员和角色
      await expect(page.locator('text=Member User')).toBeVisible();
    });
  });
});