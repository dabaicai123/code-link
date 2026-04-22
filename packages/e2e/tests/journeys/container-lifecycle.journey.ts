// packages/e2e/tests/journeys/container-lifecycle.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('容器生命周期旅程', () => {
  test('容器启动、停止和状态查询', async ({ app, api }) => {
    const userParams = createUserParams();
    const user = await app.register(userParams);
    api.setToken(generateToken(user.id));

    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    const projectParams = createProjectParams({ organizationId: org!.id });
    const project = await app.createProject(projectParams);

    // 1. 容器初始状态应为 not_created
    const initialStatus = await api.getContainerStatus(project!.id);
    expect(initialStatus.status).toBe('not_created');

    // 2. 启动容器
    const startResult = await api.startContainer(project!.id);
    expect(startResult.status).toBe('running');
    expect(startResult.containerId).toBeTruthy();

    // 3. 再次查询状态应为 running
    const runningStatus = await api.getContainerStatus(project!.id);
    expect(runningStatus.status).toBe('running');

    // 4. 停止容器
    const stopResult = await api.stopContainer(project!.id);
    expect(stopResult.status).toBe('stopped');

    // 5. 查询状态应为 stopped 或 exited
    const stoppedStatus = await api.getContainerStatus(project!.id);
    expect(['stopped', 'exited']).toContain(stoppedStatus.status);

    // 6. 重新启动容器
    const restartResult = await api.startContainer(project!.id);
    expect(restartResult.status).toBe('running');

    // 7. 删除容器
    await api.removeContainer(project!.id);

    // 8. 删除后状态应为 not_created
    const afterRemove = await api.getContainerStatus(project!.id);
    expect(afterRemove.status).toBe('not_created');

    // 清理: 删除项目
    await app.deleteProject(project!.id);
  });

  test('未配置Claude时启动容器应失败', async ({ app, api }) => {
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    // 不配置Claude，直接创建项目和启动容器
    const org = await app.createOrganization(createOrganizationParams());
    const project = await app.createProject(createProjectParams({ organizationId: org!.id }));

    // 启动容器应该失败
    try {
      await api.startContainer(project!.id);
      expect.unreachable('应该抛出错误');
    } catch (err) {
      expect((err as Error).message).toContain('请先配置');
    }

    await app.deleteProject(project!.id);
  });
});