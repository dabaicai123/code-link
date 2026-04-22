import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('会话管理', () => {
  test.beforeEach(async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));
    await app.selectProject(project!.name);
  });

  test('代理选择器显示', async ({ app }) => {
    await app.assertAgentSelected('Claude');
  });

  test('代理切换', async ({ app }) => {
    await app.assertAgentSelected('Claude');
    await app.selectAgent('codex');
  });

  test('权限模式选择器显示', async ({ app }) => {
    const modeSelect = app.page.locator('[data-testid="chat-input"]').locator('select');
    await expect(modeSelect).toBeVisible();
    await expect(modeSelect).toHaveValue('default');
  });

  test('权限模式切换', async ({ app }) => {
    await app.selectPermissionMode('plan');
    const modeSelect = app.page.locator('[data-testid="chat-input"]').locator('select');
    await expect(modeSelect).toHaveValue('plan');
  });

  test('会话重启', async ({ app }) => {
    await app.sendChatMessage('第一条消息');
    await app.assertChatMessageVisible('第一条消息', 'user');
    await app.restartChatSession();
    await app.assertSessionReset();
  });

  test('项目状态指示', async ({ app }) => {
    await app.assertConnectionStatus(true);
  });
});