import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { ProjectRepository } from '../project/repository.js';
import { ClaudeConfigRepository } from '../claude-config/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { NotFoundError, ParamError } from '../../core/errors/index.js';
import {
  createProjectContainer,
  startContainer,
  stopContainer,
  removeContainer,
  getContainerStatus,
  getProjectContainer,
} from '../../docker/container-manager.js';
import {
  createProjectVolume,
  removeProjectVolume,
  volumeExists,
} from '../../docker/volume-manager.js';
import type { ContainerStatus, ContainerStartResult, ContainerStopResult } from './types.js';

@singleton()
export class ContainerService {
  constructor(
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(ClaudeConfigRepository) private readonly claudeConfigRepo: ClaudeConfigRepository,
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}

  async start(userId: number, projectId: number): Promise<ContainerStartResult> {
    // 检查权限
    const project = await this.permService.checkProjectAccess(userId, projectId);

    // 检查用户是否有 Claude 配置
    const hasConfig = await this.claudeConfigRepo.hasConfig(userId);
    if (!hasConfig) {
      throw new ParamError('请先配置 Claude 设置');
    }

    // 如果容器已存在，直接启动
    const existingContainer = await getProjectContainer(projectId);
    if (existingContainer) {
      const containerInfo = await existingContainer.inspect();
      await startContainer(containerInfo.Id);
      await this.projectRepo.updateStatus(projectId, 'running');
      return {
        containerId: containerInfo.Id,
        status: 'running',
      };
    }

    // 创建 volume（如果不存在）
    const volume = await volumeExists(projectId);
    if (!volume) {
      await createProjectVolume(projectId);
    }

    // 创建并启动容器
    const volumePath = `/volumes/project-${projectId}`;
    const containerId = await createProjectContainer(
      projectId,
      project.templateType as 'node' | 'node+java' | 'node+python',
      volumePath
    );

    await startContainer(containerId);
    await this.projectRepo.updateContainerId(projectId, containerId);
    await this.projectRepo.updateStatus(projectId, 'running');

    return {
      containerId,
      status: 'running',
    };
  }

  async stop(userId: number, projectId: number): Promise<ContainerStopResult> {
    // 检查权限
    await this.permService.checkProjectAccess(userId, projectId);

    // 获取容器
    const container = await getProjectContainer(projectId);
    if (!container) {
      throw new NotFoundError('容器');
    }

    const containerInfo = await container.inspect();
    await stopContainer(containerInfo.Id);
    await this.projectRepo.updateStatus(projectId, 'stopped');

    return {
      containerId: containerInfo.Id,
      status: 'stopped',
    };
  }

  async getStatus(userId: number, projectId: number): Promise<ContainerStatus> {
    // 检查权限
    await this.permService.checkProjectAccess(userId, projectId);

    // 获取容器
    const container = await getProjectContainer(projectId);
    if (!container) {
      return {
        containerId: '',
        status: 'not_created',
      };
    }

    const containerInfo = await container.inspect();
    const status = await getContainerStatus(containerInfo.Id);

    return {
      containerId: containerInfo.Id,
      status,
    };
  }

  async remove(userId: number, projectId: number): Promise<void> {
    // 检查权限 - 只有组织 owner 可以删除
    const project = await this.permService.checkProjectAccess(userId, projectId);
    await this.permService.checkOrgOwner(userId, project.organizationId);

    // 获取并删除容器
    const container = await getProjectContainer(projectId);
    if (container) {
      const containerInfo = await container.inspect();
      await removeContainer(containerInfo.Id);
    }

    // 删除 volume
    await removeProjectVolume(projectId);

    // 更新项目状态
    await this.projectRepo.updateContainerId(projectId, null);
    await this.projectRepo.updateStatus(projectId, 'created');
  }
}
