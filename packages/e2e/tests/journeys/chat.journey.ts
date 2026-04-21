import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('聊天核心功能', () => {
  test.beforeEach(async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    await app.createProject(createProjectParams({ organizationId: org!.id }));
  });

  test('聊天面板渲染', async ({ app }) => {
    await app.assertChatWorkspaceVisible();
    await app.assertSessionReset();
  });

  test('发送消息并显示', async ({ app }) => {
    await app.sendChatMessage('你好');
    await app.assertChatMessageVisible('你好', 'user');
  });

  test('用户消息气泡样式', async ({ app }) => {
    await app.sendChatMessage('测试消息');
    const userBubble = app.page.locator('[data-role="user"]');
    await expect(userBubble).toBeVisible();
  });

  test('空状态欢迎页', async ({ app }) => {
    await app.assertSessionReset();
  });

  test('连接状态指示器', async ({ app }) => {
    await app.assertConnectionStatus(true);
  });
});