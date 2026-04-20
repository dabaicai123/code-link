// src/build/build-manager.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { getDockerClient } from '../docker/client.js';
import { getVolumePath } from '../docker/volume-manager.js';
import { getPreviewContainerManager } from './preview-container.js';
import { BuildRepository } from '../modules/build/repository.js';
import type { SelectBuild } from '../db/schema/index.js';

export class BuildManager {
  private buildRepo: BuildRepository;

  constructor() {
    this.buildRepo = container.resolve(BuildRepository);
  }

  async createBuild(projectId: number): Promise<SelectBuild> {
    const build = await this.buildRepo.create({ projectId });
    // WebSocket notification will be added later when websocket module is available
    return build;
  }

  async startBuild(projectId: number, buildId: number): Promise<void> {
    // 更新状态为 running
    await this.updateBuildStatus(buildId, 'running');

    try {
      const docker = getDockerClient();
      const volumePath = getVolumePath(projectId);

      // 构建 Docker 镜像
      const stream = await docker.buildImage(
        { context: volumePath, src: ['.'] },
        { t: `code-link-build-${buildId}:latest` }
      );

      // 等待构建完成
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (err, output) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 启动预览容器
      const previewManager = getPreviewContainerManager();
      const previewPort = await previewManager.createPreviewContainer(
        `code-link-build-${buildId}:latest`,
        projectId.toString()
      );

      // 更新状态为 success
      await this.updateBuildStatus(buildId, 'success', previewPort);
    } catch (error: any) {
      // 更新状态为 failed
      await this.updateBuildStatus(buildId, 'failed');
      throw error;
    }
  }

  async updateBuildStatus(
    buildId: number,
    status: 'pending' | 'running' | 'success' | 'failed',
    previewPort?: number
  ): Promise<void> {
    await this.buildRepo.updateStatus(buildId, status, previewPort);
  }

  async getBuild(buildId: number): Promise<SelectBuild | null> {
    const build = await this.buildRepo.findById(buildId);
    return build ?? null;
  }

  async getProjectBuilds(projectId: number): Promise<SelectBuild[]> {
    return this.buildRepo.findByProjectId(projectId);
  }

  async getLatestBuild(projectId: number): Promise<SelectBuild | null> {
    const build = await this.buildRepo.findLatestByProjectId(projectId);
    return build ?? null;
  }
}

// 全局单例
let buildManagerInstance: BuildManager | null = null;

export function getBuildManager(): BuildManager {
  if (!buildManagerInstance) {
    buildManagerInstance = new BuildManager();
  }
  return buildManagerInstance;
}

// 重置实例（用于测试）
export function resetBuildManagerInstance(): void {
  buildManagerInstance = null;
}