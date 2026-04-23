import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

/**
 * Claude Code 聊天集成旅程 — 测试完整的消息发送 → AI 回复流程
 *
 * 此测试使用真实 API 端点（通过 ANTHROPIC_BASE_URL 配置）验证：
 * 1. 自定义 API 提供商配置（base URL、auth token、模型）
 * 2. 容器启动与 Claude Code CLI 初始化
 * 3. 终端会话建立
 * 4. 消息发送与 AI 回复接收
 *
 * 需要环境变量：
 * - E2E_ANTHROPIC_BASE_URL: API 端点 URL
 * - E2E_ANTHROPIC_AUTH_TOKEN: API 认证 token
 * - E2E_ANTHROPIC_MODEL: 要使用的模型名称
 *
 * 如果未设置这些变量，测试将跳过。
 */
const ANTHROPIC_BASE_URL = process.env.E2E_ANTHROPIC_BASE_URL;
const ANTHROPIC_AUTH_TOKEN = process.env.E2E_ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_MODEL = process.env.E2E_ANTHROPIC_MODEL;

test.skip(!ANTHROPIC_BASE_URL || !ANTHROPIC_AUTH_TOKEN || !ANTHROPIC_MODEL,
  '需要设置 E2E_ANTHROPIC_BASE_URL, E2E_ANTHROPIC_AUTH_TOKEN, E2E_ANTHROPIC_MODEL 环境变量');

test.describe('Claude Code 聊天集成', () => {
  test('配置自定义提供商并发送消息接收回复', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    // 1. 配置自定义 Claude Code 提供商
    await app.configureClaude({
      authToken: ANTHROPIC_AUTH_TOKEN!,
      baseUrl: ANTHROPIC_BASE_URL!,
      opusModel: ANTHROPIC_MODEL!,
      sonnetModel: ANTHROPIC_MODEL!,
      haikuModel: ANTHROPIC_MODEL!,
    });

    // 验证配置已保存
    await app.page.reload();
    await app.page.getByText('Claude Code', { exact: true }).click();
    const configText = await app.page.locator('textarea').inputValue();
    expect(configText).toContain(ANTHROPIC_BASE_URL!);
    expect(configText).toContain(ANTHROPIC_MODEL!);

    // 2. 创建组织和项目
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));

    // 3. 启动容器
    const startResult = await api.startContainer(project!.id);
    expect(startResult.status).toBe('running');
    expect(startResult.containerId).toBeTruthy();

    // 4. 选中项目（连接终端）
    await app.selectProject(project!.name);

    // 5. 等待终端连接就绪
    await app.assertConnectionStatus(true);

    // 6. 发送聊天消息
    await app.sendChatMessage('请回复"测试成功"');

    // 7. 等待用户消息出现
    await app.assertChatMessageVisible('请回复"测试成功"', 'user');

    // 8. 等待 AI 回复 — assistant 消息出现（可能需要较长时间等待模型响应）
    await expect(app.page.locator('[data-role="assistant"]').first())
      .toBeVisible({ timeout: 60000 });

    // 9. 验证回复内容非空
    const assistantMsg = app.page.locator('[data-role="assistant"]').first();
    const msgText = assistantMsg.locator('.msg-text');
    await expect(msgText).not.toBeEmpty({ timeout: 30000 });

    // 10. 清理：停止并删除容器
    await api.stopContainer(project!.id);
    await api.removeContainer(project!.id);
    await app.deleteProject(project!.id);
  });

  test('自定义提供商配置持久化', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    // 配置自定义提供商
    await app.configureClaude({
      authToken: ANTHROPIC_AUTH_TOKEN!,
      baseUrl: ANTHROPIC_BASE_URL!,
      opusModel: ANTHROPIC_MODEL!,
    });

    // 重新加载页面验证持久化
    await app.page.reload();
    await app.page.getByText('Claude Code', { exact: true }).click();
    const configText = await app.page.locator('textarea').inputValue();

    const config = JSON.parse(configText);
    expect(config.env.ANTHROPIC_BASE_URL).toBe(ANTHROPIC_BASE_URL);
    expect(config.env.ANTHROPIC_AUTH_TOKEN).toBe(ANTHROPIC_AUTH_TOKEN);
    expect(config.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe(ANTHROPIC_MODEL);
  });
});