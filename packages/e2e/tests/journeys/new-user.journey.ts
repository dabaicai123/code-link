// packages/e2e/tests/journeys/new-user.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('新用户完整旅程', () => {
  test('从注册到项目启动的完整流程', async ({ app, db, api }) => {
    // 创建初始快照
    db.checkpoint('journey-start');

    try {
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
      expect(org.name).toBe(orgParams.name);

      // 6. 创建项目
      const projectParams = createProjectParams({ organizationId: org.id });
      const project = await app.createProject(projectParams);
      expect(project.name).toBe(projectParams.name);

      // 7. 启动项目
      await app.startProject(project.id);
      await app.assertProjectRunning(project.id);

    } finally {
      // 回滚数据
      db.rollback('journey-start');
    }
  });

  test('用户登录流程', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 先注册一个用户
      const userParams = createUserParams();
      await app.register(userParams);

      // 登出
      await app.logout();
      await app.assertOnLoginPage();

      // 重新登录
      await app.login(userParams.email, userParams.password);
      await app.assertLoggedIn();

    } finally {
      db.rollback('journey-start');
    }
  });
});