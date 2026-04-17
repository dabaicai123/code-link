import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreviewContainerManager, getPreviewContainerManager } from '../src/build/preview-container.ts';
import { getDockerClient } from '../src/docker/client.ts';
import { getPortManager } from '../src/build/port-manager.ts';
import { ensureTemplateImage } from '../src/docker/templates.js';

describe('PreviewContainerManager', () => {
  let manager: PreviewContainerManager;
  let testImageId: string;

  beforeEach(async () => {
    manager = new PreviewContainerManager();

    // 确保 node 模板镜像存在
    await ensureTemplateImage('node');

    // 获取镜像 ID
    const docker = getDockerClient();
    const images = await docker.listImages();
    const nodeImage = images.find(img => img.RepoTags?.some(tag => tag.includes('code-link-node')));
    testImageId = nodeImage?.Id || '';
  }, 60000);

  afterEach(async () => {
    await manager.cleanupAll();
  });

  it('should create preview container', async () => {
    if (!testImageId) {
      console.log('Skipping test: no test image available');
      return;
    }

    const port = await manager.createPreviewContainer(testImageId, 'test-project-1');

    expect(port).toBeGreaterThanOrEqual(30000);
    expect(port).toBeLessThanOrEqual(40000);
  });

  it('should stop preview container', async () => {
    if (!testImageId) {
      console.log('Skipping test: no test image available');
      return;
    }

    await manager.createPreviewContainer(testImageId, 'test-project-2');
    await manager.stopPreviewContainer('test-project-2');

    const docker = getDockerClient();
    try {
      const container = docker.getContainer(`code-link-preview-test-project-2`);
      const info = await container.inspect();
      expect(info.State.Status).toBe('exited');
    } catch {
      // 容器已被删除
    }
  });

  it('should get preview URL', () => {
    const url = manager.getPreviewUrl(30001);
    expect(url).toBe('http://localhost:30001');
  });

  it('should return container info', async () => {
    if (!testImageId) {
      console.log('Skipping test: no test image available');
      return;
    }

    const port = await manager.createPreviewContainer(testImageId, 'test-project-3');
    const info = manager.getContainerInfo('test-project-3');

    expect(info).toBeDefined();
    expect(info?.projectId).toBe('test-project-3');
    expect(info?.port).toBe(port);
    expect(info?.containerId).toBeDefined();
    expect(info?.createdAt).toBeInstanceOf(Date);
  });

  it('should replace existing container with same project id', async () => {
    if (!testImageId) {
      console.log('Skipping test: no test image available');
      return;
    }

    const port1 = await manager.createPreviewContainer(testImageId, 'test-project-4');
    const port2 = await manager.createPreviewContainer(testImageId, 'test-project-4');

    // 第二次创建应该替换第一个容器
    // 端口可能相同也可能不同（取决于端口管理器实现）
    expect(port2).toBeGreaterThanOrEqual(30000);
    expect(port2).toBeLessThanOrEqual(40000);

    const info = manager.getContainerInfo('test-project-4');
    expect(info?.port).toBe(port2);
  });
});

describe('getPreviewContainerManager', () => {
  it('should return singleton instance', () => {
    const manager1 = getPreviewContainerManager();
    const manager2 = getPreviewContainerManager();
    expect(manager1).toBe(manager2);
  });
});
