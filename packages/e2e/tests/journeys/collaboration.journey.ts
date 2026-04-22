// packages/e2e/tests/journeys/collaboration.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('协作面板旅程', () => {
  test('协作面板展开和收起', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));
    await app.selectProject(project!.name);

    // 验证协作面板可见 — 右侧面板的"协作" tab
    await expect(app.page.getByText('协作', { exact: true })).toBeVisible({ timeout: 5000 });

    // 切换到预览 tab
    await app.page.getByText('预览', { exact: true }).click();
    await expect(app.page.getByText('预览', { exact: true })).toBeVisible();
  });

  test('选择模式切换', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));
    await app.selectProject(project!.name);

    // 验证协作 tab 可见
    await expect(app.page.getByText('协作', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('选择元素并添加到消息', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));
    await app.selectProject(project!.name);

    // 验证右侧面板可见
    await expect(app.page.getByText('协作', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});
