import "reflect-metadata";
import { singleton, inject } from "tsyringe";
import { DockerService } from '../../container/lib/docker.service.js';
import { BuildRepository } from '../repository.js';
import { PreviewContainerManager } from './preview-container.js';
import type { SelectBuild } from '../../../db/schema/index.js';

@singleton()
export class BuildManager {
  constructor(
    @inject(BuildRepository) private readonly buildRepo: BuildRepository,
    @inject(DockerService) private readonly dockerService: DockerService,
    @inject(PreviewContainerManager) private readonly previewManager: PreviewContainerManager
  ) {}

  async createBuild(projectId: number): Promise<SelectBuild> {
    const build = await this.buildRepo.create({ projectId });
    return build;
  }

  async startBuild(projectId: number, buildId: number): Promise<void> {
    await this.updateBuildStatus(buildId, 'running');

    try {
      // TODO: Implement build logic using DockerService
      // This is a placeholder for the build process

      // 启动预览容器
      const previewPort = await this.previewManager.createPreviewContainer(
        `code-link-build-${buildId}:latest`,
        projectId.toString()
      );

      await this.updateBuildStatus(buildId, 'success', previewPort);
    } catch (error: unknown) {
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
