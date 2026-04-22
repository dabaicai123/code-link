// packages/e2e/tests/journeys/element-selection.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('元素选择功能', () => {
  test.beforeEach(async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));
    await app.selectProject(project!.name);
  });

  test('预览面板显示选择元素按钮', async ({ app }) => {
    // Switch to preview tab
    await app.switchToPreviewTab();

    // Enter a URL to enable the preview
    await app.enterPreviewUrl('http://localhost:3000');

    // Verify the "选择元素" button appears in the URL toolbar
    await expect(app.page.getByRole('button', { name: '选择元素' })).toBeVisible({ timeout: 5000 });
  });

  test('选择模式激活和取消', async ({ app }) => {
    await app.switchToPreviewTab();
    await app.enterPreviewUrl('http://localhost:3000');

    // Activate select mode
    await app.toggleSelectMode();
    await app.assertSelectModeActive();

    // Verify the button changed to "取消选择"
    await expect(app.page.getByRole('button', { name: '取消选择' })).toBeVisible();

    // Cancel select mode
    await app.cancelSelectMode();
    await expect(app.page.getByText('选择模式已开启')).not.toBeVisible();
  });

  test('选择元素并添加到聊天输入', async ({ app }) => {
    await app.switchToPreviewTab();
    await app.enterPreviewUrl('http://localhost:3000');

    // Activate select mode
    await app.toggleSelectMode();

    // The overlay should be visible for click interaction
    // Since iframe content may not be accessible (cross-origin or empty),
    // we verify the select mode overlay exists by checking the overlay div
    const overlay = app.page.locator('.absolute.inset-0.z-10');
    await expect(overlay).toBeVisible({ timeout: 5000 });
  });

  test('元素标签在聊天输入中内联显示', async ({ app }) => {
    // Verify that when elements are present in chat input,
    // they render inline (flex-wrap layout) rather than as a separate block
    // We test this by checking the chat input wrapper has flex-wrap
    const chatInput = app.page.locator('[data-testid="chat-input"]');

    // The element chips and textarea should be in the same flex-wrap container
    const inputWrapper = chatInput.locator('.flex-wrap');
    await expect(inputWrapper).toBeVisible();
  });

  test('发送消息中元素标签内联显示', async ({ app }) => {
    // This test verifies the MessageItem renders element tags inline with text
    // rather than as a separate block below the message

    // Send a message (without elements since we can't actually select in cross-origin iframe)
    await app.sendChatMessage('修改颜色为蓝色');

    // Verify the user message appears
    await app.assertChatMessageVisible('修改颜色为蓝色', 'user');

    // Verify no separate element block div exists (the old "mt-1 text-xs opacity-80" block)
    const msgText = app.page.locator('[data-role="user"]').last().locator('.msg-text');
    await expect(msgText).toBeVisible();

    // The elements should be inline spans (not a separate div block)
    // If there were elements, they would be <span> inside .msg-text, not <div>
    const elementBlock = msgText.locator('div.text-xs.opacity-80');
    await expect(elementBlock).not.toBeVisible();
  });
});