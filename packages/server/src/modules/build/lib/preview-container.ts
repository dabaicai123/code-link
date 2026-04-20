import { singleton, inject } from 'tsyringe';
import Docker from 'dockerode';
import { DockerService } from '../../container/lib/docker.service.js';
import { getPortManager } from './port-manager.js';
import { createLogger } from '../../../core/logger/index.js';

const logger = createLogger('preview');
const PREVIEW_CONTAINER_PREFIX = 'code-link-preview-';

interface PreviewContainer {
  containerId: string;
  projectId: string;
  port: number;
  createdAt: Date;
}

@singleton()
export class PreviewContainerManager {
  private containers: Map<string, PreviewContainer> = new Map();
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async createPreviewContainer(
    imageId: string,
    projectId: string,
    env?: Record<string, string>
  ): Promise<number> {
    const portManager = getPortManager();

    // 分配端口
    const port = portManager.allocatePort();

    // 停止并移除旧的预览容器（如果存在）
    await this.stopPreviewContainer(projectId);

    // 创建并启动容器
    let container;
    try {
      container = await this.docker.createContainer({
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
    } catch (error) {
      // 启动失败时释放端口
      portManager.releasePort(port);
      throw error;
    }

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
    const portManager = getPortManager();
    const info = this.containers.get(projectId);

    if (info) {
      try {
        const container = this.docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
      } catch (error) {
        logger.error('Failed to stop container', error instanceof Error ? error : new Error(String(error)));
      }

      // 释放端口
      portManager.releasePort(info.port);
      this.containers.delete(projectId);
    } else {
      // 尝试通过名称查找
      try {
        const container = this.docker.getContainer(`${PREVIEW_CONTAINER_PREFIX}${projectId}`);
        const containerInfo = await container.inspect();
        await container.stop();
        await container.remove();

        // 尝试从端口绑定中释放端口
        const portBinding = containerInfo.NetworkSettings?.Ports?.['3000/tcp']?.[0]?.HostPort;
        if (portBinding) {
          portManager.releasePort(parseInt(portBinding, 10));
        }
      } catch (error) {
        logger.error('Failed to stop container by name', error instanceof Error ? error : new Error(String(error)));
      }
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
    const portManager = getPortManager();

    for (const [projectId, info] of this.containers) {
      try {
        const container = this.docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
      } catch (error) {
        logger.error('Failed to cleanup container', error instanceof Error ? error : new Error(String(error)));
      }

      // 释放端口
      portManager.releasePort(info.port);
    }

    this.containers.clear();
  }
}

// 重置实例（用于测试）
export function resetPreviewContainerManagerInstance(): void {
  // PreviewContainerManager is now a singleton managed by DI
}