import { getDockerClient } from '../docker/client.js';
import { getPortManager } from './port-manager.js';

const PREVIEW_CONTAINER_PREFIX = 'code-link-preview-';

interface PreviewContainer {
  containerId: string;
  projectId: string;
  port: number;
  createdAt: Date;
}

export class PreviewContainerManager {
  private containers: Map<string, PreviewContainer> = new Map();

  async createPreviewContainer(
    imageId: string,
    projectId: string,
    env?: Record<string, string>
  ): Promise<number> {
    const docker = getDockerClient();
    const portManager = getPortManager();

    // 分配端口
    const port = portManager.allocatePort();

    // 停止并移除旧的预览容器（如果存在）
    await this.stopPreviewContainer(projectId);

    // 创建并启动容器
    const container = await docker.createContainer({
      name: `${PREVIEW_CONTAINER_PREFIX}${projectId}`,
      Image: imageId,
      ExposedPorts: {
        '3000/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          '3000/tcp': [{ HostPort: port.toString() }],
        },
      },
      Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : [],
    });

    await container.start();

    // 记录容器信息
    this.containers.set(projectId, {
      containerId: container.id,
      projectId,
      port,
      createdAt: new Date(),
    });

    return port;
  }

  async stopPreviewContainer(projectId: string): Promise<void> {
    const docker = getDockerClient();
    const info = this.containers.get(projectId);

    if (info) {
      try {
        const container = docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
      } catch {}
      this.containers.delete(projectId);
    } else {
      // 尝试通过名称查找
      try {
        const container = docker.getContainer(`${PREVIEW_CONTAINER_PREFIX}${projectId}`);
        const info = await container.inspect();
        await container.stop();
        await container.remove();
      } catch {}
    }
  }

  getPreviewUrl(port: number): string {
    const host = process.env.PREVIEW_HOST || 'localhost';
    return `http://${host}:${port}`;
  }

  getContainerInfo(projectId: string): PreviewContainer | undefined {
    return this.containers.get(projectId);
  }

  async cleanupAll(): Promise<void> {
    const docker = getDockerClient();

    for (const [projectId, info] of this.containers) {
      try {
        const container = docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
      } catch {}
    }

    this.containers.clear();
  }
}

// 全局单例
let previewManagerInstance: PreviewContainerManager | null = null;

export function getPreviewContainerManager(): PreviewContainerManager {
  if (!previewManagerInstance) {
    previewManagerInstance = new PreviewContainerManager();
  }
  return previewManagerInstance;
}
