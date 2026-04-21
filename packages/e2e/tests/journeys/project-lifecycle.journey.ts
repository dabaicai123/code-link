// packages/e2e/tests/journeys/project-lifecycle.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('项目生命周期旅程', () => {
  test('项目创建和删除流程', async ({ app, api }) => {
    // 前置：创建用户和组织
    const userParams = createUserParams();
    const user = await app.register(userParams);
    api.setToken(generateToken(user.id));

    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());

    // 1. 创建项目
    const projectParams = createProjectParams({ organizationId: org!.id });
    const project = await app.createProject(projectParams);
    await app.assertProjectVisible(projectParams.name);

    // 2. 删除项目
    await app.deleteProject(project!.id);
    await app.assertProjectNotVisible(projectParams.name);
  });

  test('多项目显示', async ({ app, api }) => {
    // 前置准备
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());

    // 创建多个项目
    const projectNames = ['Project Alpha', 'Project Beta', 'Project Gamma'];
    for (const name of projectNames) {
      await app.createProject({ name });
    }

    // 验证所有项目可见
    await app.page.goto('/dashboard');
    for (const name of projectNames) {
      await app.assertProjectVisible(name);
    }
  });
});