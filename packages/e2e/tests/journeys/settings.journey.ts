// packages/e2e/tests/journeys/settings.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams } from '../support/factories';

test.describe('配置管理旅程', () => {
  test('Claude Code 配置管理', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    // 进入设置页
    await app.page.goto('/settings');
    await expect(app.page.getByRole('tab', { name: '组织' })).toBeVisible();
    await expect(app.page.getByRole('tab', { name: 'Claude Code' })).toBeVisible();

    // 配置 Claude Code
    await app.configureClaude({ authToken: 'sk-ant-test-token-12345' });

    // 验证配置已保存
    await app.page.reload();
    await app.page.getByRole('tab', { name: 'Claude Code' }).click();
    const configText = await app.page.locator('textarea').inputValue();
    expect(configText).toContain('sk-ant-test-token-12345');
  });

  test('切换设置标签', async ({ app }) => {
    await app.register(createUserParams());
    await app.page.goto('/settings');

    // 默认在组织标签
    await expect(app.page.getByText('+ 创建组织')).toBeVisible();

    // 切换到 Claude Code 标签
    await app.page.getByRole('tab', { name: 'Claude Code' }).click();
    await expect(app.page.getByText('JSON 配置')).toBeVisible();

    // 切换回组织标签
    await app.page.getByRole('tab', { name: '组织' }).click();
    await expect(app.page.getByText('+ 创建组织')).toBeVisible();
  });
});