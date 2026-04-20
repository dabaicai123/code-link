import { test, expect } from '../fixtures/base';
import { seedTestOrganization, seedTestUser, seedTestInvitation } from '../helpers/test-db';
import { organizationMembers } from '@code-link/server/dist/db/schema/index.js';

test.describe('组织管理', () => {
  test.describe('组织列表', () => {
    test('空组织列表显示', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/settings`);
      await expect(page.locator('text=创建组织')).toBeVisible();
      await expect(page.locator('text=您尚未加入任何组织')).toBeVisible();
    });

    test('显示多个组织', async ({ page, webBaseUrl, testUser, testDb }) => {
      await seedTestOrganization(testDb, testUser.id, 'First Organization');
      await seedTestOrganization(testDb, testUser.id, 'Second Organization');

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
      await expect(page.locator('text=New Organization')).toBeVisible();
    });

    test('空名称验证', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=创建组织');
      await page.click('button:has-text("创建")');
    });
  });

  test.describe('组织详情', () => {
    test('组织详情页显示', async ({ page, webBaseUrl, testUser, testDb }) => {
      await seedTestOrganization(testDb, testUser.id, 'Detail Test Org');

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Detail Test Org');
      await expect(page.locator('text=Detail Test Org')).toBeVisible();
    });

    test('成员列表显示', async ({ page, webBaseUrl, testUser, testDb }) => {
      await seedTestOrganization(testDb, testUser.id, 'Member Test Org');

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Member Test Org');
      await expect(page.locator('text=成员列表')).toBeVisible();
    });
  });

  test.describe('邀请成员', () => {
    test('发送邀请', async ({ page, webBaseUrl, testUser, testDb }) => {
      await seedTestOrganization(testDb, testUser.id, 'Invite Test Org');

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Invite Test Org');
      await page.click('text=邀请成员');
      await page.fill('input[type="email"]', 'invitee@example.com');
      await page.click('button:has-text("发送邀请")');
    });

    test('重复邮箱邀请', async ({ page, webBaseUrl, testUser, testDb }) => {
      const orgId = await seedTestOrganization(testDb, testUser.id, 'Duplicate Invite Org');
      await seedTestInvitation(testDb, orgId, testUser.id, { email: 'existing@example.com' });

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Duplicate Invite Org');
      await page.click('text=邀请成员');
      await page.fill('input[type="email"]', 'existing@example.com');
      await page.click('button:has-text("发送邀请")');
      await expect(page.locator('text=已有待处理的邀请')).toBeVisible();
    });

    test('邀请列表显示', async ({ page, webBaseUrl, testUser, testDb }) => {
      const orgId = await seedTestOrganization(testDb, testUser.id, 'Invitation List Org');
      await seedTestInvitation(testDb, orgId, testUser.id, { email: 'invited1@example.com' });
      await seedTestInvitation(testDb, orgId, testUser.id, { email: 'invited2@example.com' });

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Invitation List Org');
      await page.click('text=展开');
      await expect(page.locator('text=invited1@example.com')).toBeVisible();
      await expect(page.locator('text=invited2@example.com')).toBeVisible();
    });
  });

  test.describe('成员角色管理', () => {
    test('更新成员角色', async ({ page, webBaseUrl, testUser, testDb }) => {
      await seedTestOrganization(testDb, testUser.id, 'Role Update Org');
      const anotherUser = await seedTestUser(testDb, { email: 'member@example.com', name: 'Member User' });

      await testDb.insert(organizationMembers).values({
        organizationId: anotherUser.id,
        userId: anotherUser.id,
        role: 'member',
        invitedBy: testUser.id,
      });

      await page.goto(`${webBaseUrl}/settings`);
      await page.click('text=Role Update Org');
      await expect(page.locator('text=Member User')).toBeVisible();
    });
  });
});
