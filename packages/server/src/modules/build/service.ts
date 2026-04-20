import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { BuildRepository } from './repository.js';
import { ProjectRepository } from '../project/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { NotFoundError } from '../../core/errors/index.js';
import { getBuildManager } from '../../build/build-manager.js';
import { getPreviewContainerManager } from '../../build/preview-container.js';
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
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}

  async create(userId: number, input: CreateBuildInput): Promise<SelectBuild> {
    const project = await this.permService.checkProjectAccess(userId, input.projectId);

    const buildManager = getBuildManager();
    const build = await buildManager.createBuild(input.projectId);

    buildManager.startBuild(input.projectId, build.id).catch((error) => {
      logger.error('Build failed', error instanceof Error ? error : new Error(String(error)), { projectId: input.projectId, buildId: build.id });
    });

    return build;
  }

  async findByProjectId(userId: number, projectId: number): Promise<SelectBuild[]> {
    await this.permService.checkProjectAccess(userId, projectId);

    const buildManager = getBuildManager();
    return buildManager.getProjectBuilds(projectId);
  }

  async findById(userId: number, buildId: number): Promise<SelectBuild> {
    const buildManager = getBuildManager();
    const build = await buildManager.getBuild(buildId);

    if (!build) {
      throw new NotFoundError('构建');
    }

    await this.permService.checkProjectAccess(userId, build.projectId);

    return build;
  }

  async getPreview(userId: number, projectId: number): Promise<PreviewInfo> {
    await this.permService.checkProjectAccess(userId, projectId);

    const previewManager = getPreviewContainerManager();
    const containerInfo = previewManager.getContainerInfo(projectId.toString());

    if (!containerInfo) {
      throw new NotFoundError('预览容器');
    }

    return {
      url: previewManager.getPreviewUrl(containerInfo.port),
      port: containerInfo.port,
    };
  }

  async stopPreview(userId: number, projectId: number): Promise<void> {
    await this.permService.checkProjectAccess(userId, projectId);

    const previewManager = getPreviewContainerManager();
    await previewManager.stopPreviewContainer(projectId.toString());
  }
}
