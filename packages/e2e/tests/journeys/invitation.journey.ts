// packages/e2e/tests/journeys/invitation.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('邀请处理旅程', () => {
  test('接受邀请并加入组织', async ({ app, api }) => {
    // 创建邀请者用户和组织
    const inviterParams = createUserParams();
    const inviter = await app.register(inviterParams);
    api.setToken(generateToken(inviter.id));
    const org = await app.createOrganization(
      createOrganizationParams({ name: '邀请组织' })
    );

    // 邀请另一个用户
    const inviteeEmail = createUserParams().email;
    await app.inviteMember(org!.id, inviteeEmail);

    // 登出邀请者
    await app.logout();

    // 被邀请者注册（使用被邀请的邮箱）
    const inviteeParams = createUserParams({ email: inviteeEmail });
    await app.register(inviteeParams);

    // 查看邀请并接受
    await app.acceptInvitation('邀请组织');

    // 验证已加入组织
    await app.page.goto('/settings');
    await expect(app.page.getByText('邀请组织')).toBeVisible({ timeout: 5000 });
  });

  test('拒绝邀请', async ({ app, api }) => {
    // 准备邀请
    const inviter = await app.register(createUserParams());
    api.setToken(generateToken(inviter.id));
    const org = await app.createOrganization(createOrganizationParams({ name: '拒绝测试组织' }));

    const inviteeEmail = createUserParams().email;
    await app.inviteMember(org!.id, inviteeEmail);

    // 被邀请者注册
    await app.logout();
    const inviteeParams = createUserParams({ email: inviteeEmail });
    await app.register(inviteeParams);

    // 拒绝邀请
    await app.declineInvitation('拒绝测试组织');

    // 验证未加入组织
    await app.page.goto('/settings');
    await expect(app.page.getByText('拒绝测试组织')).not.toBeVisible({ timeout: 5000 });
  });
});