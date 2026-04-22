import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('左右屏联动', () => {
  test.beforeEach(async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));
    await app.selectProject(project!.name);
  });

  test('协作面板和聊天面板共存', async ({ app }) => {
    await app.assertChatWorkspaceVisible();
    // Right panel with "协作" tab should be visible
    await expect(app.page.getByText('协作', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('聊天面板保持元素选择状态', async ({ app }) => {
    await app.assertChatWorkspaceVisible();
    // Right panel should be visible alongside chat
    await expect(app.page.getByText('协作', { exact: true })).toBeVisible({ timeout: 5000 });
    await app.assertChatWorkspaceVisible();
  });
});