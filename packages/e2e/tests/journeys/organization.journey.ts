// packages/e2e/tests/journeys/organization.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('组织管理旅程', () => {
  test('组织创建与成员邀请', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    const org = await app.createOrganization(
      createOrganizationParams({ name: '邀请测试组织' })
    );

    // 邀请成员
    const inviteeEmail = createUserParams().email;
    await app.inviteMember(org!.id, inviteeEmail);
  });

  test('多组织显示', async ({ app, api }) => {
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
      await expect(app.page.getByText(name)).toBeVisible({ timeout: 5000 });
    }
  });

  test('空组织列表显示', async ({ app }) => {
    await app.register(createUserParams());
    await app.page.goto('/settings');
    await expect(app.page.getByText('+ 创建组织')).toBeVisible();
  });
});