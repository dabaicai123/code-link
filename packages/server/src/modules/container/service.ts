import "reflect-metadata";
import { singleton, inject, container } from 'tsyringe';
import { ProjectService } from '../project/project.module.js';
import { OrganizationService } from '../organization/organization.module.js';
import { PermissionService } from '../../shared/permission.service.js';
import { ClaudeConfigService } from '../claude-config/claude-config.module.js';
import { DockerService } from './lib/docker.service.js';
import { NotFoundError, ParamError } from '../../core/errors/index.js';
import type { ContainerStartResult, ContainerStopResult, ContainerStatus } from './types.js';

@singleton()
export class ContainerService {
  constructor(
    @inject(ProjectService) private readonly projectService: ProjectService,
    @inject(OrganizationService) private readonly orgService: OrganizationService,
    @inject(PermissionService) private readonly permService: PermissionService,
    @inject(ClaudeConfigService) private readonly claudeConfigService: ClaudeConfigService,
    @inject(DockerService) private readonly dockerService: DockerService
  ) {}

  private async requireProjectAccess(userId: number, projectId: number): Promise<import('../../db/schema/index.js').SelectProject> {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) throw new NotFoundError('项目');
    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);
    return project;
  }

  async start(userId: number, projectId: number): Promise<ContainerStartResult> {
    const project = await this.requireProjectAccess(userId, projectId);

    const hasConfig = await this.claudeConfigService.hasConfig(userId);
    if (!hasConfig) {
      throw new ParamError('请先配置 Claude 设置');
    }

    const existingContainer = await this.dockerService.getProjectContainer(projectId);
    if (existingContainer) {
      const containerInfo = await existingContainer.inspect();
      await this.dockerService.startContainer(containerInfo.Id);
      await this.projectService.updateStatus(projectId, 'running');
      return {
        containerId: containerInfo.Id,
        status: 'running',
      };
    }

    const volume = await this.dockerService.volumeExists(projectId);
    if (!volume) {
      await this.dockerService.createProjectVolume(projectId);
    }

    const volumePath = `/volumes/project-${projectId}`;
    const containerId = await this.dockerService.createProjectContainer(
      projectId,
      project.templateType as 'node' | 'node+java' | 'node+python',
      volumePath
    );

    await this.dockerService.startContainer(containerId);
    await this.projectService.updateContainerId(projectId, containerId);
    await this.projectService.updateStatus(projectId, 'running');

    return { containerId, status: 'running' };
  }

  async stop(userId: number, projectId: number): Promise<ContainerStopResult> {
    await this.requireProjectAccess(userId, projectId);

    const container = await this.dockerService.getProjectContainer(projectId);
    if (!container) {
      throw new NotFoundError('容器');
    }

    const containerInfo = await container.inspect();
    await this.dockerService.stopContainer(containerInfo.Id);
    await this.projectService.updateStatus(projectId, 'stopped');

    return { containerId: containerInfo.Id, status: 'stopped' };
  }

  async getStatus(userId: number, projectId: number): Promise<ContainerStatus> {
    await this.requireProjectAccess(userId, projectId);

    const container = await this.dockerService.getProjectContainer(projectId);
    if (!container) {
      return { containerId: '', status: 'not_created' };
    }

    const containerInfo = await container.inspect();
    const status = await this.dockerService.getContainerStatus(containerInfo.Id);

    return { containerId: containerInfo.Id, status };
  }

  async remove(userId: number, projectId: number): Promise<void> {
    const project = await this.requireProjectAccess(userId, projectId);
    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireOrgOwner(userId, role);

    const container = await this.dockerService.getProjectContainer(projectId);
    if (container) {
      const containerInfo = await container.inspect();
      await this.dockerService.removeContainer(containerInfo.Id);
    }

    await this.dockerService.removeProjectVolume(projectId);

    await this.projectService.updateContainerId(projectId, null);
    await this.projectService.updateStatus(projectId, 'created');
  }
}