// packages/e2e/tests/journeys/settings.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams } from '../support/factories';

test.describe('配置管理旅程', () => {
  test('Claude Code 配置管理', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));

      // 进入设置页
      await app.page.goto('/settings');
      await expect(app.page.locator('text=组织')).toBeVisible();
      await expect(app.page.locator('text=Claude Code')).toBeVisible();

      // 配置 Claude Code
      await app.configureClaude({ authToken: 'sk-ant-test-token-12345' });

      // 验证配置已保存
      await app.page.reload();
      await app.page.click('text=Claude Code');
      const configText = await app.page.locator('textarea').inputValue();
      expect(configText).toContain('sk-ant-test-token-12345');

    } finally {
      db.rollback('journey-start');
    }
  });

  test('切换设置标签', async ({ app, db }) => {
    db.checkpoint('journey-start');

    try {
      await app.register(createUserParams());
      await app.page.goto('/settings');

      // 默认在组织标签
      await expect(app.page.locator('text=创建组织')).toBeVisible();

      // 切换到 Claude Code 标签
      await app.page.click('text=Claude Code');
      await expect(app.page.locator('text=JSON 配置')).toBeVisible();

      // 切换回组织标签
      await app.page.click('text=组织');
      await expect(app.page.locator('text=创建组织')).toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });
});