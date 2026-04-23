import "reflect-metadata";
import { singleton, inject, container } from 'tsyringe';
import { BuildRepository } from './repository.js';
import { ProjectService } from '../project/project.module.js';
import { OrganizationService } from '../organization/organization.module.js';
import { PermissionService } from '../../shared/permission.service.js';
import { BuildManager } from './lib/build-manager.js';
import { PreviewContainerManager } from './lib/preview-container.js';
import { NotFoundError, normalizeError } from '../../core/errors/index.js';
import { createLogger } from '../../core/logger/index.js';
import { SocketServerService } from '../../socket/socket-server.service.js';
import { broadcastBuildStatus } from '../../socket/namespaces/project.js';
import type { PaginatedResult } from '../../core/database/pagination.js';
import type { SelectBuild } from '../../db/schema/index.js';
import type { CreateBuildInput } from './schemas.js';
import type { PreviewInfo } from './types.js';

const logger = createLogger('build-service');

@singleton()
export class BuildService {
  constructor(
    @inject(BuildRepository) private readonly repo: BuildRepository,
    @inject(BuildManager) private readonly buildManager: BuildManager,
    @inject(PreviewContainerManager) private readonly previewManager: PreviewContainerManager,
    @inject(ProjectService) private readonly projectService: ProjectService,
    @inject(OrganizationService) private readonly orgService: OrganizationService,
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}

  private async requireProjectAccess(userId: number, projectId: number): Promise<void> {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) throw new NotFoundError('项目');
    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);
  }

  async create(userId: number, input: CreateBuildInput): Promise<SelectBuild> {
    await this.requireProjectAccess(userId, input.projectId);

    const build = await this.buildManager.createBuild(input.projectId);

    this.buildManager.startBuild(input.projectId, build.id).catch(async (error: unknown) => {
      const err = normalizeError(error);
      logger.error('Build failed', err, { projectId: input.projectId, buildId: build.id });

      await this.repo.updateStatus(build.id, 'failed');

      const socketService = container.resolve(SocketServerService);
      const io = socketService.getServer();
      broadcastBuildStatus(io.of('/project'), input.projectId, 'failed', undefined, err.message);
    });

    return build;
  }

  async findByProjectId(userId: number, projectId: number, page?: number, limit?: number): Promise<PaginatedResult<SelectBuild>> {
    await this.requireProjectAccess(userId, projectId);

    return this.buildManager.getProjectBuilds(projectId, page, limit);
  }

  async findById(userId: number, buildId: number): Promise<SelectBuild> {
    const build = await this.buildManager.getBuild(buildId);

    if (!build) {
      throw new NotFoundError('构建');
    }

    await this.requireProjectAccess(userId, build.projectId);

    return build;
  }

  async getPreview(userId: number, projectId: number): Promise<PreviewInfo> {
    await this.requireProjectAccess(userId, projectId);

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
    await this.requireProjectAccess(userId, projectId);

    await this.previewManager.stopPreviewContainer(projectId.toString());
  }
}