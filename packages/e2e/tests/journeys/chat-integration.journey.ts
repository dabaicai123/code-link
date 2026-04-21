import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('左右屏联动', () => {
  test.beforeEach(async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    await app.createProject(createProjectParams({ organizationId: org!.id }));
  });

  test('协作面板和聊天面板共存', async ({ app }) => {
    await app.assertChatWorkspaceVisible();
    await app.assertCollaborationPanelVisible();
  });

  test('聊天面板保持元素选择状态', async ({ app }) => {
    await app.assertChatWorkspaceVisible();
    await app.expandCollaborationPanel();
    await app.toggleSelectMode();
    await app.assertSelectModeActive();
    await app.assertChatWorkspaceVisible();
    await app.cancelSelectMode();
  });
});