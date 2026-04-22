import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { ProjectRepository } from '../project/repository.js';
import { ClaudeConfigRepository } from '../claude-config/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { DockerService } from './lib/docker.service.js';
import { NotFoundError, ParamError } from '../../core/errors/index.js';
import type { ContainerStatus, ContainerStartResult, ContainerStopResult } from './types.js';

@singleton()
export class ContainerService {
  constructor(
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(ClaudeConfigRepository) private readonly claudeConfigRepo: ClaudeConfigRepository,
    @inject(PermissionService) private readonly permService: PermissionService,
    @inject(DockerService) private readonly dockerService: DockerService
  ) {}

  async start(userId: number, projectId: number): Promise<ContainerStartResult> {
    const project = await this.permService.checkProjectAccess(userId, projectId);

    const hasConfig = await this.claudeConfigRepo.hasConfig(userId);
    if (!hasConfig) {
      throw new ParamError('请先配置 Claude 设置');
    }

    const existing = await this.dockerService.getProjectContainerInfo(projectId);
    if (existing) {
      await this.dockerService.startContainer(existing.id);
      await this.projectRepo.updateStatus(projectId, 'running');
      return { containerId: existing.id, status: 'running' };
    }

    const volumePath = `/volumes/project-${projectId}`;
    const containerId = await this.dockerService.createProjectContainer(
      projectId,
      project.templateType as 'node' | 'node+java' | 'node+python',
      volumePath
    );

    await this.dockerService.startContainer(containerId);
    await this.projectRepo.updateContainerId(projectId, containerId);
    await this.projectRepo.updateStatus(projectId, 'running');

    return { containerId, status: 'running' };
  }

  async stop(userId: number, projectId: number): Promise<ContainerStopResult> {
    await this.permService.checkProjectAccess(userId, projectId);

    const existing = await this.dockerService.getProjectContainerInfo(projectId);
    if (!existing) {
      throw new NotFoundError('容器');
    }

    await this.dockerService.stopContainer(existing.id);
    await this.projectRepo.updateStatus(projectId, 'stopped');

    return { containerId: existing.id, status: 'stopped' };
  }

  async getStatus(userId: number, projectId: number): Promise<ContainerStatus> {
    await this.permService.checkProjectAccess(userId, projectId);

    const existing = await this.dockerService.getProjectContainerInfo(projectId);
    if (!existing) {
      return { containerId: '', status: 'not_created' };
    }

    return { containerId: existing.id, status: existing.status };
  }

  async remove(userId: number, projectId: number): Promise<void> {
    const project = await this.permService.checkProjectAccess(userId, projectId);
    await this.permService.checkOrgOwner(userId, project.organizationId);

    const existing = await this.dockerService.getProjectContainerInfo(projectId);
    if (existing) {
      await this.dockerService.removeContainer(existing.id);
    }

    await this.dockerService.removeProjectVolume(projectId);
    await this.projectRepo.updateContainerId(projectId, null);
    await this.projectRepo.updateStatus(projectId, 'created');
  }
}