import { execInContainer } from '../docker/container-manager.js';
import { TokenManager } from './token-manager.js';
import { ProjectRepository } from '../repositories/index.js';
import type { SelectProjectRepo } from '../db/schema/index.js';

interface CloneResult {
  success: boolean;
  path: string;
  error?: string;
}

interface PushResult {
  success: boolean;
  error?: string;
}

export class RepoManager {
  private tokenManager: TokenManager;
  private projectRepo: ProjectRepository;

  constructor() {
    this.tokenManager = new TokenManager();
    this.projectRepo = new ProjectRepository();
  }

  // 转义 shell 命令参数，防止命令注入
  private escapeShellArg(arg: string): string {
    // 使用单引号包裹，并转义内部单引号
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  async cloneRepo(
    containerId: string,
    projectId: number,
    repoUrl: string,
    userId: number
  ): Promise<CloneResult> {
    try {
      const provider = this.detectProvider(repoUrl);
      const token = await this.tokenManager.getToken(userId, provider);

      if (!token) {
        return {
          success: false,
          path: '',
          error: `未找到 ${provider} 的授权，请先在设置中授权`
        };
      }

      const repoName = this.extractRepoName(repoUrl);
      const clonePath = `/workspace/project-${projectId}/${repoName}`;
      const authUrl = this.injectTokenIntoUrl(repoUrl, token.accessToken);

      const { stdout, stderr, exitCode } = await execInContainer(containerId, [
        'bash', '-c',
        `mkdir -p /workspace/project-${projectId} && cd /workspace/project-${projectId} && git clone --depth 1 ${this.escapeShellArg(authUrl)} ${this.escapeShellArg(repoName)}`
      ]);

      if (exitCode !== 0) {
        return { success: false, path: '', error: stderr };
      }

      return { success: true, path: clonePath };
    } catch (error: any) {
      return { success: false, path: '', error: error.message };
    }
  }

  async pushRepo(
    containerId: string,
    projectId: number,
    repoUrl: string,
    branch: string,
    commitMessage: string,
    userId: number,
    userName: string,
    userEmail: string
  ): Promise<PushResult> {
    try {
      const provider = this.detectProvider(repoUrl);
      const token = await this.tokenManager.getToken(userId, provider);

      if (!token) {
        return {
          success: false,
          error: `未找到 ${provider} 的授权，请先在设置中授权`
        };
      }

      const repoName = this.extractRepoName(repoUrl);
      const authUrl = this.injectTokenIntoUrl(repoUrl, token.accessToken);

      // 使用用户真实身份配置 git（参数已转义防止命令注入）
      const commands = [
        `cd /workspace/project-${projectId}/${this.escapeShellArg(repoName)}`,
        `git config user.name ${this.escapeShellArg(userName)}`,
        `git config user.email ${this.escapeShellArg(userEmail)}`,
        `git add -A`,
        `git commit -m ${this.escapeShellArg(commitMessage)}`,
        `git push ${this.escapeShellArg(authUrl)} HEAD:${this.escapeShellArg(branch)}`,
      ];

      const { stdout, stderr, exitCode } = await execInContainer(containerId, [
        'bash', '-c',
        commands.join('\n')
      ]);

      if (exitCode !== 0) {
        return { success: false, error: stderr };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async addRepoAssociation(
    projectId: number,
    provider: 'github' | 'gitlab',
    repoUrl: string,
    repoName: string,
    branch: string
  ): Promise<SelectProjectRepo> {
    return this.projectRepo.addRepo({
      projectId,
      provider,
      repoUrl,
      repoName,
      branch,
    });
  }

  async getProjectRepos(projectId: number): Promise<SelectProjectRepo[]> {
    return this.projectRepo.findRepos(projectId);
  }

  async removeRepoAssociation(projectId: number, repoUrl: string): Promise<void> {
    const repos = await this.projectRepo.findRepos(projectId);
    const repo = repos.find(r => r.repoUrl === repoUrl);
    if (repo) {
      await this.projectRepo.deleteRepo(repo.id);
    }
  }

  detectProvider(url: string): 'github' | 'gitlab' {
    if (url.includes('github.com')) return 'github';
    if (url.includes('gitlab')) return 'gitlab';
    throw new Error('Unknown Git provider');
  }

  injectTokenIntoUrl(url: string, token: string): string {
    // 将 token 注入 URL：https://github.com/user/repo.git -> https://token@github.com/user/repo.git
    return url.replace('https://', `https://${token}@`);
  }

  extractRepoName(url: string): string {
    // 从 URL 提取仓库名：https://github.com/user/repo.git -> repo
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace('.git', '');
  }
}