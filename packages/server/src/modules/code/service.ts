import { singleton, inject } from 'tsyringe';
import { DockerService } from '../container/lib/docker.service.js';
import { ProjectRepository } from '../project/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { NotFoundError } from '../../core/errors/index.js';
import { CodeServerManager } from './lib/code-server-manager.js';

@singleton()
export class CodeService {
  constructor(
    @inject(DockerService) private readonly docker: DockerService,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(PermissionService) private readonly permission: PermissionService,
    @inject(CodeServerManager) private readonly codeServerManager: CodeServerManager,
  ) {}

  async startCodeServer(userId: number, projectId: number): Promise<{ url: string }> {
    const project = await this.permission.checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    const port = await this.codeServerManager.startCodeServer(projectId, project.containerId);
    const url = this.codeServerManager.getCodeServerUrl(projectId)!;
    return { url };
  }

  async stopCodeServer(userId: number, projectId: number): Promise<{ success: boolean }> {
    const project = await this.permission.checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    await this.codeServerManager.stopCodeServer(projectId, project.containerId);
    return { success: true };
  }

  async getCodeServerStatus(userId: number, projectId: number): Promise<{ running: boolean; url: string | null }> {
    await this.permission.checkProjectAccess(userId, projectId);
    const running = this.codeServerManager.isRunning(projectId);
    const url = this.codeServerManager.getCodeServerUrl(projectId);
    return { running, url };
  }
}