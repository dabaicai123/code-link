import type Database from 'better-sqlite3';
import { execInContainer } from '../docker/container-manager.js';
import { TokenManager } from './token-manager.js';
import type { ProjectRepo } from '../types.js';

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
  private db: Database.Database;
  private tokenManager: TokenManager;

  constructor(db: Database.Database) {
    this.db = db;
    this.tokenManager = new TokenManager(db);
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
      const token = this.tokenManager.getToken(userId, provider);

      if (!token) {
        return {
          success: false,
          path: '',
          error: `未找到 ${provider} 的授权，请先在设置中授权`
        };
      }

      const repoName = this.extractRepoName(repoUrl);
      const clonePath = `/workspace/project-${projectId}/${repoName}`;
      const authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);

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
      const token = this.tokenManager.getToken(userId, provider);

      if (!token) {
        return {
          success: false,
          error: `未找到 ${provider} 的授权，请先在设置中授权`
        };
      }

      const repoName = this.extractRepoName(repoUrl);
      const authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);

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

  addRepoAssociation(
    projectId: number,
    provider: 'github' | 'gitlab',
    repoUrl: string,
    repoName: string,
    branch: string
  ): void {
    this.db
      .prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)')
      .run(projectId, provider, repoUrl, repoName, branch);
  }

  getProjectRepos(projectId: number): ProjectRepo[] {
    return this.db
      .prepare('SELECT * FROM project_repos WHERE project_id = ?')
      .all(projectId) as ProjectRepo[];
  }

  removeRepoAssociation(projectId: number, repoUrl: string): void {
    this.db
      .prepare('DELETE FROM project_repos WHERE project_id = ? AND repo_url = ?')
      .run(projectId, repoUrl);
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