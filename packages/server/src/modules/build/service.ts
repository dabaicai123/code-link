import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { BuildRepository } from './repository.js';
import { ProjectRepository } from '../project/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { BuildManager } from './lib/build-manager.js';
import { PreviewContainerManager } from './lib/preview-container.js';
import { NotFoundError } from '../../core/errors/index.js';
import { createLogger } from '../../core/logger/index.js';
import type { SelectBuild } from '../../db/schema/index.js';
import type { CreateBuildInput } from './schemas.js';
import type { PreviewInfo } from './types.js';

const logger = createLogger('build-service');

@singleton()
export class BuildService {
  constructor(
    @inject(BuildRepository) private readonly repo: BuildRepository,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(PermissionService) private readonly permService: PermissionService,
    @inject(BuildManager) private readonly buildManager: BuildManager,
    @inject(PreviewContainerManager) private readonly previewManager: PreviewContainerManager
  ) {}

  async create(userId: number, input: CreateBuildInput): Promise<SelectBuild> {
    const project = await this.permService.checkProjectAccess(userId, input.projectId);

    const build = await this.buildManager.createBuild(input.projectId);

    this.buildManager.startBuild(input.projectId, build.id).catch((error: unknown) => {
      logger.error('Build failed', error instanceof Error ? error : new Error(String(error)), { projectId: input.projectId, buildId: build.id });
    });

    return build;
  }

  async findByProjectId(userId: number, projectId: number): Promise<SelectBuild[]> {
    await this.permService.checkProjectAccess(userId, projectId);

    return this.buildManager.getProjectBuilds(projectId);
  }

  async findById(userId: number, buildId: number): Promise<SelectBuild> {
    const build = await this.buildManager.getBuild(buildId);

    if (!build) {
      throw new NotFoundError('构建');
    }

    await this.permService.checkProjectAccess(userId, build.projectId);

    return build;
  }

  async getPreview(userId: number, projectId: number): Promise<PreviewInfo> {
    await this.permService.checkProjectAccess(userId, projectId);

    const containerInfo = this.previewManager.getContainerInfo(projectId.toString());

    if (!containerInfo) {
      throw new NotFoundError('预览容器');
    }

    return {
      url: this.previewManager.getPreviewUrl(containerInfo.port),
      port: containerInfo.port,
    };
  }

  async stopPreview(userId: number, projectId: number): Promise<void> {
    await this.permService.checkProjectAccess(userId, projectId);

    await this.previewManager.stopPreviewContainer(projectId.toString());
  }
}