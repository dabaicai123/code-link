import { singleton, inject, container } from 'tsyringe';
import { PermissionService } from '../../shared/permission.service.js';
import { NotFoundError } from '../../core/errors/index.js';
import { CodeServerManager } from './lib/code-server-manager.js';

let _permService: PermissionService | null = null;
function getPermService() { return _permService ??= container.resolve(PermissionService); }

/** Reset lazy getter cache (for tests after container.reset()) */
export function resetCodeServiceCache(): void { _permService = null; }

@singleton()
export class CodeService {
  constructor(
    @inject(CodeServerManager) private readonly codeServerManager: CodeServerManager,
  ) {}

  async startCodeServer(userId: number, projectId: number): Promise<{ url: string }> {
    const project = await getPermService().checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    await this.codeServerManager.startCodeServer(projectId, project.containerId);
    const url = this.codeServerManager.getCodeServerUrl(projectId);
    if (!url) throw new Error('code-server URL not available after start');
    return { url };
  }

  async stopCodeServer(userId: number, projectId: number): Promise<{ success: boolean }> {
    const project = await getPermService().checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    await this.codeServerManager.stopCodeServer(projectId, project.containerId);
    return { success: true };
  }

  async getCodeServerStatus(userId: number, projectId: number): Promise<{ running: boolean; url: string | null }> {
    await getPermService().checkProjectAccess(userId, projectId);
    const running = this.codeServerManager.isRunning(projectId);
    const url = this.codeServerManager.getCodeServerUrl(projectId);
    return { running, url };
  }
}