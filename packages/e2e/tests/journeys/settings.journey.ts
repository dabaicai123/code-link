// packages/e2e/tests/journeys/settings.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams } from '../support/factories';

test.describe('配置管理旅程', () => {
  test('Claude Code 配置管理', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    // 进入设置页 — 默认显示账户页
    await app.page.goto('/settings');
    await expect(app.page.getByText('个人资料')).toBeVisible();
    await expect(app.page.getByText('组织管理')).toBeVisible();
    await expect(app.page.getByText('Claude Code')).toBeVisible();

    // 配置 Claude Code
    await app.configureClaude({ authToken: 'sk-ant-test-token-12345' });

    // 验证配置已保存
    await app.page.reload();
    // Navigate to Claude Code page via sidebar after reload
    await app.page.getByText('Claude Code', { exact: true }).click();
    const configText = await app.page.locator('textarea').inputValue();
    expect(configText).toContain('sk-ant-test-token-12345');
  });

  test('切换设置页面', async ({ app }) => {
    await app.register(createUserParams());
    await app.page.goto('/settings');

    // 默认在账户页
    await expect(app.page.getByText('个人资料')).toBeVisible();

    // 切换到组织管理页
    await app.page.getByText('组织管理', { exact: true }).click();
    await expect(app.page.getByText('创建新组织')).toBeVisible();

    // 切换到 Claude Code 页
    await app.page.getByText('Claude Code', { exact: true }).click();
    await expect(app.page.getByText('JSON 配置')).toBeVisible();

    // 切换回账户页
    await app.page.getByText('个人资料', { exact: true }).click();
    await expect(app.page.getByText('个人资料')).toBeVisible();
  });
});