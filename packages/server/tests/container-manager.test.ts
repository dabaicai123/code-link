import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProjectContainer, startContainer, stopContainer, removeContainer, getContainerStatus } from '../src/docker/container-manager.ts';
import { getDockerClient } from '../src/docker/client.ts';

describe('Container Manager', () => {
  const testProjectId = 9999;
  const testTemplate = 'node';

  afterEach(async () => {
    // 清理测试容器
    const docker = getDockerClient();
    try {
      const container = docker.getContainer(`code-link-project-${testProjectId}`);
      await container.remove({ force: true });
    } catch {}
  });

  it('should create a container for a project', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    expect(containerId).toBeDefined();
    expect(containerId.length).toBeGreaterThan(0);
  });

  it('should start a stopped container', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    await startContainer(containerId);
    const status = await getContainerStatus(containerId);
    expect(status).toBe('running');
  });

  it('should stop a running container', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    await startContainer(containerId);
    await stopContainer(containerId);
    const status = await getContainerStatus(containerId);
    expect(status).toBe('exited');
  });

  it('should remove a container', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    await removeContainer(containerId);
    const docker = getDockerClient();
    try {
      await docker.getContainer(containerId).inspect();
      expect.fail('Container should be removed');
    } catch (error: any) {
      expect(error.statusCode).toBe(404);
    }
  });
});
