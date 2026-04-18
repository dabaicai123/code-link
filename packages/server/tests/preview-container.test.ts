import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PreviewContainerManager, getPreviewContainerManager } from '../src/build/preview-container.ts';
import { getDockerClient } from '../src/docker/client.ts';
import { getPortManager, resetPortManagerInstance } from '../src/build/port-manager.ts';
import { ensureTemplateImage } from '../src/docker/templates.js';

describe('PreviewContainerManager', () => {
  const docker = getDockerClient();
  let testImageId: string | null = null;
  let manager: PreviewContainerManager;
  // 用于跟踪测试中创建的容器，确保全部清理
  const createdProjectIds: Set<string> = new Set();

  // 所有测试前确保镜像存在
  beforeAll(async () => {
    // 重置 PortManager 实例确保干净的端口状态
    resetPortManagerInstance();

    // 检查 node 模板镜像是否存在，不存在则构建
    await ensureTemplateImage('node');

    // 获取镜像 ID
    const images = await docker.listImages();
    const nodeImage = images.find(img => img.RepoTags?.some(tag => tag.includes('code-link-node')));
    testImageId = nodeImage?.Id || null;
  }, 120000);

  // 所有测试后清理所有可能残留的容器
  afterAll(async () => {
    // 清理所有可能残留的测试容器
    const cleanupProjectIds = [
      'test-single-create',
      'test-recreate',
      'test-stop',
      'test-info',
      'test-cleanup-1',
      'test-cleanup-2',
      'test-cleanup-3',
      ...createdProjectIds,
    ];

    for (const projectId of cleanupProjectIds) {
      try {
        const containerName = `code-link-preview-${projectId}`;
        const container = docker.getContainer(containerName);
        const info = await container.inspect();
        // 尝试释放端口
        const portBinding = info.NetworkSettings?.Ports?.['3000/tcp']?.[0]?.HostPort;
        if (portBinding) {
          const portManager = getPortManager();
          portManager.releasePort(parseInt(portBinding, 10));
        }
        await container.remove({ force: true });
      } catch {
        // 容器不存在，忽略
      }
    }

    // 重置 PortManager
    resetPortManagerInstance();
  }, 60000);

  beforeEach(async () => {
    // 每个测试前创建新的 manager 实例
    manager = new PreviewContainerManager();
    createdProjectIds.clear();
  }, 10000);

  afterEach(async () => {
    // 每个测试后清理 manager 跟踪的容器
    try {
      await manager.cleanupAll();
    } catch {
      // 清理失败时，手动清理创建的容器
      for (const projectId of createdProjectIds) {
        try {
          const container = docker.getContainer(`code-link-preview-${projectId}`);
          await container.remove({ force: true });
        } catch {
          // 忽略
        }
      }
    }
    createdProjectIds.clear();
  }, 30000);

  describe('createPreviewContainer', () => {
    it('should create preview container and return port', async () => {
      if (!testImageId) {
        console.log('Skipping test: no test image available');
        return;
      }

      const projectId = 'test-single-create';
      createdProjectIds.add(projectId);

      const port = await manager.createPreviewContainer(testImageId, projectId);

      expect(port).toBeGreaterThanOrEqual(30000);
      expect(port).toBeLessThanOrEqual(40000);

      // 验证容器实际存在
      const containerInfo = manager.getContainerInfo(projectId);
      expect(containerInfo).toBeDefined();
      expect(containerInfo?.port).toBe(port);

      // 验证 Docker 容器确实存在
      const dockerContainer = docker.getContainer(containerInfo!.containerId);
      const inspectInfo = await dockerContainer.inspect();
      expect(inspectInfo.State.Running).toBe(true);
    }, 30000);

    it('should stop and remove existing container with same project id', async () => {
      if (!testImageId) {
        console.log('Skipping test: no test image available');
        return;
      }

      const projectId = 'test-recreate';
      createdProjectIds.add(projectId);

      // 第一次创建
      const port1 = await manager.createPreviewContainer(testImageId, projectId);

      // 验证第一次创建成功
      const info1 = manager.getContainerInfo(projectId);
      expect(info1?.port).toBe(port1);
      const firstContainerId = info1?.containerId;

      // 第二次创建同名容器（会替换旧的）
      const port2 = await manager.createPreviewContainer(testImageId, projectId);

      expect(port2).toBeGreaterThanOrEqual(30000);
      expect(port2).toBeLessThanOrEqual(40000);

      const info2 = manager.getContainerInfo(projectId);
      expect(info2?.port).toBe(port2);

      // 验证容器 ID 已更改（是新容器）
      expect(info2?.containerId).not.toBe(firstContainerId);

      // 验证只存在一个容器
      const allContainers = await docker.listContainers({ all: true });
      const matchingContainers = allContainers.filter(
        c => c.Names.some(n => n.includes(`code-link-preview-${projectId}`))
      );
      expect(matchingContainers.length).toBe(1);
    }, 30000);
  });

  describe('stopPreviewContainer', () => {
    it('should stop preview container and release port', async () => {
      if (!testImageId) {
        console.log('Skipping test: no test image available');
        return;
      }

      const projectId = 'test-stop';
      createdProjectIds.add(projectId);

      const port = await manager.createPreviewContainer(testImageId, projectId);

      const portManager = getPortManager();
      expect(portManager.isPortInUse(port)).toBe(true);

      await manager.stopPreviewContainer(projectId);

      expect(portManager.isPortInUse(port)).toBe(false);

      // 验证容器信息已清除
      const info = manager.getContainerInfo(projectId);
      expect(info).toBeUndefined();

      // 验证容器已被删除
      const allContainers = await docker.listContainers({ all: true });
      const matchingContainers = allContainers.filter(
        c => c.Names.some(n => n.includes(`code-link-preview-${projectId}`))
      );
      expect(matchingContainers.length).toBe(0);

      // 已清理，移除跟踪
      createdProjectIds.delete(projectId);
    }, 30000);

    it('should handle non-existent container gracefully', async () => {
      // 不存在的容器，不应该抛错
      await manager.stopPreviewContainer('non-existent-project');
    });
  });

  describe('getPreviewUrl', () => {
    it('should get preview URL', () => {
      const url = manager.getPreviewUrl(30001);
      expect(url).toBe('http://localhost:30001');
    });

    it('should use custom host from env', () => {
      const originalHost = process.env.PREVIEW_HOST;
      process.env.PREVIEW_HOST = 'custom.host';

      const url = manager.getPreviewUrl(30001);
      expect(url).toBe('http://custom.host:30001');

      process.env.PREVIEW_HOST = originalHost;
    });
  });

  describe('getContainerInfo', () => {
    it('should return container info', async () => {
      if (!testImageId) {
        console.log('Skipping test: no test image available');
        return;
      }

      const projectId = 'test-info';
      createdProjectIds.add(projectId);

      const port = await manager.createPreviewContainer(testImageId, projectId);
      const info = manager.getContainerInfo(projectId);

      expect(info).toBeDefined();
      expect(info?.projectId).toBe(projectId);
      expect(info?.port).toBe(port);
      expect(info?.containerId).toBeDefined();
      expect(info?.createdAt).toBeInstanceOf(Date);
    }, 30000);

    it('should return undefined for non-existent project', () => {
      const info = manager.getContainerInfo('non-existent');
      expect(info).toBeUndefined();
    });
  });

  describe('cleanupAll', () => {
    it('should release all ports when cleanupAll is called', async () => {
      if (!testImageId) {
        console.log('Skipping test: no test image available');
        return;
      }

      const portManager = getPortManager();

      const projectIds = ['test-cleanup-1', 'test-cleanup-2', 'test-cleanup-3'];
      for (const projectId of projectIds) {
        createdProjectIds.add(projectId);
      }

      const port1 = await manager.createPreviewContainer(testImageId, projectIds[0]);
      const port2 = await manager.createPreviewContainer(testImageId, projectIds[1]);
      const port3 = await manager.createPreviewContainer(testImageId, projectIds[2]);

      // 验证端口已被分配
      expect(portManager.isPortInUse(port1)).toBe(true);
      expect(portManager.isPortInUse(port2)).toBe(true);
      expect(portManager.isPortInUse(port3)).toBe(true);

      // 清理所有容器
      await manager.cleanupAll();

      // 验证所有端口已被释放
      expect(portManager.isPortInUse(port1)).toBe(false);
      expect(portManager.isPortInUse(port2)).toBe(false);
      expect(portManager.isPortInUse(port3)).toBe(false);

      // 验证容器信息已清除
      for (const projectId of projectIds) {
        expect(manager.getContainerInfo(projectId)).toBeUndefined();
      }

      // 验证容器已被删除
      const allContainers = await docker.listContainers({ all: true });
      for (const projectId of projectIds) {
        const matchingContainers = allContainers.filter(
          c => c.Names.some(n => n.includes(`code-link-preview-${projectId}`))
        );
        expect(matchingContainers.length).toBe(0);
      }

      // 已清理，移除跟踪
      createdProjectIds.clear();
    }, 60000);
  });
});

describe('getPreviewContainerManager', () => {
  it('should return singleton instance', async () => {
    const manager1 = getPreviewContainerManager();
    const manager2 = getPreviewContainerManager();
    expect(manager1).toBe(manager2);
  });
});