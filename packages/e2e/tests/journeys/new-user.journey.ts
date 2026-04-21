// packages/e2e/tests/journeys/new-user.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('新用户完整旅程', () => {
  test('从注册到项目创建的完整流程', async ({ app, api }) => {
    // 1. 注册新用户
    const userParams = createUserParams();
    const user = await app.register(userParams);
    expect(user.email).toBe(userParams.email);
    expect(user.name).toBe(userParams.name);

    // 2. 验证自动登录成功
    await app.assertLoggedIn();

    // 3. 设置 API token
    api.setToken(generateToken(user.id));

    // 4. 配置 Claude Code
    await app.configureClaude({ authToken: 'sk-test-token-xxx' });

    // 5. 创建组织
    const orgParams = createOrganizationParams();
    const org = await app.createOrganization(orgParams);
    expect(org!.name).toBe(orgParams.name);

    // 6. 创建项目
    const projectParams = createProjectParams({ organizationId: org!.id });
    const project = await app.createProject(projectParams);
    expect(project!.name).toBe(projectParams.name);
  });

  test('用户登录流程', async ({ app, api }) => {
    // 先注册一个用户
    const userParams = createUserParams();
    const user = await app.register(userParams);
    api.setToken(generateToken(user.id));

    // 登出
    await app.logout();
    await app.assertOnLoginPage();

    // 重新登录
    await app.login(userParams.email, userParams.password);
    await app.assertLoggedIn();
  });
});