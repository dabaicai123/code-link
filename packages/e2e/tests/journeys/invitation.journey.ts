// packages/e2e/tests/journeys/invitation.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('邀请处理旅程', () => {
  test('接受邀请并加入组织', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 创建邀请者用户和组织
      const inviterParams = createUserParams({ email: 'inviter@test.com' });
      const inviter = await app.register(inviterParams);
      api.setToken(generateToken(inviter.id));
      const org = await app.createOrganization(
        createOrganizationParams({ name: '邀请组织' })
      );

      // 邀请另一个用户
      const inviteeEmail = 'invitee@test.com';
      await app.inviteMember(org.id, inviteeEmail);

      // 登出邀请者
      await app.logout();

      // 被邀请者注册
      const inviteeParams = createUserParams({ email: inviteeEmail });
      await app.register(inviteeParams);

      // 查看邀请列表
      await app.goToInvitations();
      await expect(app.page.locator('text=邀请组织')).toBeVisible();

      // 接受邀请
      await app.page.click('button:has-text("接受")');
      await app.page.waitForSelector('text=已加入组织', { timeout: 5000 });

      // 验证已加入组织
      await app.page.goto('/settings');
      await expect(app.page.locator('text=邀请组织')).toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });

  test('拒绝邀请', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 准备邀请
      const inviter = await app.register(createUserParams({ email: 'inviter2@test.com' }));
      api.setToken(generateToken(inviter.id));
      const org = await app.createOrganization(createOrganizationParams({ name: '拒绝测试组织' }));

      const inviteeEmail = 'declined@test.com';
      await app.inviteMember(org.id, inviteeEmail);

      // 被邀请者登录
      await app.logout();
      await app.register(createUserParams({ email: inviteeEmail }));

      // 拒绝邀请
      await app.goToInvitations();
      await app.page.click('button:has-text("拒绝")');
      await app.page.waitForSelector('text=已拒绝邀请', { timeout: 5000 });

      // 验证未加入组织
      await app.page.goto('/settings');
      await expect(app.page.locator('text=拒绝测试组织')).not.toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });
});