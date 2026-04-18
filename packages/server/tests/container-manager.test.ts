import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createProjectContainer, startContainer, stopContainer, removeContainer, getContainerStatus } from '../src/docker/container-manager.ts';
import { getDockerClient } from '../src/docker/client.ts';

describe('Container Manager', () => {
  const testProjectId = 9999;
  const testTemplate = 'node';
  const testVolumePath = '/tmp/test-volume';

  let sharedContainerId: string | null = null;
  const docker = getDockerClient();

  // 所有测试前创建一个共享容器
  beforeAll(async () => {
    // 检查 node 镜像是否存在，不存在则拉取
    try {
      await docker.getImage('node:22-slim').inspect();
    } catch {
      // 镜像不存在，拉取
      await new Promise<void>((resolve, reject) => {
        docker.pull('node:22-slim', (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }

    // 创建共享容器
    sharedContainerId = await createProjectContainer(testProjectId, testTemplate, testVolumePath);
  }, 60000);

  // 所有测试后清理共享容器
  afterAll(async () => {
    if (sharedContainerId) {
      try {
        await removeContainer(sharedContainerId);
      } catch {
        // 容器可能已不存在
      }
      sharedContainerId = null;
    }
  }, 15000);

  it('should create a container for a project', async () => {
    // 共享容器已在 beforeAll 创建
    expect(sharedContainerId).toBeDefined();
    expect(sharedContainerId!.length).toBeGreaterThan(0);
  });

  it('should start a stopped container', async () => {
    await startContainer(sharedContainerId!);
    const status = await getContainerStatus(sharedContainerId!);
    expect(status).toBe('running');
  }, 10000);

  it('should stop a running container', async () => {
    // 确保容器正在运行
    try {
      await startContainer(sharedContainerId!);
    } catch {
      // 可能已经在运行
    }

    await stopContainer(sharedContainerId!);
    const status = await getContainerStatus(sharedContainerId!);
    expect(status).toBe('exited');
  }, 20000);

  it('should remove a container', async () => {
    // 这个测试会删除容器
    await removeContainer(sharedContainerId!);

    try {
      await docker.getContainer(sharedContainerId!).inspect();
      expect.fail('Container should be removed');
    } catch (error: any) {
      expect(error.statusCode).toBe(404);
    }

    // 标记为已删除，避免 afterAll 再次尝试删除
    sharedContainerId = null;
  }, 15000);
});