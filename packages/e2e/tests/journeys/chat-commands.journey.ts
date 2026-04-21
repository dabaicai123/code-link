import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('斜杠命令和附件', () => {
  test.beforeEach(async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    await app.createProject(createProjectParams({ organizationId: org!.id }));
  });

  test('斜杠命令菜单打开', async ({ app }) => {
    await app.openSlashCommandMenu();
    await app.assertSlashCommandMenuVisible();
  });

  test('斜杠命令列表显示', async ({ app }) => {
    await app.openSlashCommandMenu();
    await expect(app.page.getByText('/clear')).toBeVisible();
    await expect(app.page.getByText('/help')).toBeVisible();
  });

  test('键盘导航选择命令', async ({ app }) => {
    await app.openSlashCommandMenu();
    await app.navigateSlashCommandMenu(0);
  });

  test('关闭斜杠命令菜单', async ({ app }) => {
    await app.openSlashCommandMenu();
    await app.page.keyboard.press('Escape');
    await expect(app.page.locator('.cmd-menu')).not.toBeVisible();
  });

  test('图片上传预览', async ({ app }) => {
    await app.uploadImageAttachment('/home/lsx/code-link/packages/e2e/tests/fixtures/sample-image.png');
    await app.assertImagePreviewVisible(1);
  });

  test('移除图片附件', async ({ app }) => {
    await app.uploadImageAttachment('/home/lsx/code-link/packages/e2e/tests/fixtures/sample-image.png');
    await app.assertImagePreviewVisible(1);
    await app.removeImageAttachment(0);
    await app.assertImagePreviewVisible(0);
  });
});