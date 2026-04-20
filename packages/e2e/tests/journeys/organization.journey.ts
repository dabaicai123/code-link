// packages/e2e/tests/journeys/organization.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('组织管理旅程', () => {
  test('组织创建与成员邀请', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 创建用户和组织
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));
      const org = await app.createOrganization(
        createOrganizationParams({ name: '邀请测试组织' })
      );

      // 邀请成员
      await app.inviteMember(org.id, 'invited-member@example.com');

      // 验证邀请在列表中
      await app.page.goto('/settings');
      await app.page.click('text=邀请测试组织');
      await app.page.click('text=展开');
      await expect(app.page.locator('text=invited-member@example.com')).toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });

  test('多组织显示', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));

      // 创建多个组织
      const orgNames = ['First Organization', 'Second Organization', 'Third Organization'];
      for (const name of orgNames) {
        await app.createOrganization({ name });
      }

      // 验证所有组织可见
      await app.page.goto('/settings');
      for (const name of orgNames) {
        await expect(app.page.locator(`text=${name}`)).toBeVisible();
      }

    } finally {
      db.rollback('journey-start');
    }
  });

  test('空组织列表显示', async ({ app, db }) => {
    db.checkpoint('journey-start');

    try {
      await app.register(createUserParams());
      await app.page.goto('/settings');
      await expect(app.page.locator('text=创建组织')).toBeVisible();
    } finally {
      db.rollback('journey-start');
    }
  });
});