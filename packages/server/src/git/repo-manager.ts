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

  async cloneRepo(
    containerId: string,
    repoUrl: string,
    branch: string,
    userId?: number
  ): Promise<CloneResult> {
    try {
      // 获取 token（如果提供了 userId）
      let authUrl = repoUrl;
      if (userId) {
        const token = this.tokenManager.getToken(userId, this.detectProvider(repoUrl));
        if (token) {
          authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);
        }
      }

      // 在容器内执行 git clone
      const repoName = this.extractRepoName(repoUrl);
      const { stdout, stderr, exitCode } = await execInContainer(containerId, [
        'bash', '-c',
        `cd /workspace && git clone --branch ${branch} --depth 1 ${authUrl} ${repoName}`
      ]);

      if (exitCode !== 0) {
        return { success: false, path: '', error: stderr };
      }

      return { success: true, path: `/workspace/${repoName}` };
    } catch (error: any) {
      return { success: false, path: '', error: error.message };
    }
  }

  async pushRepo(
    containerId: string,
    repoUrl: string,
    branch: string,
    commitMessage: string,
    userId?: number
  ): Promise<PushResult> {
    try {
      const repoName = this.extractRepoName(repoUrl);

      // 获取 token
      let authUrl = repoUrl;
      if (userId) {
        const token = this.tokenManager.getToken(userId, this.detectProvider(repoUrl));
        if (token) {
          authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);
        }
      }

      // 在容器内执行 git add, commit, push
      const commands = [
        `cd /workspace/${repoName}`,
        `git config user.email "bot@code-link.app"`,
        `git config user.name "CodeLink Bot"`,
        `git add -A`,
        `git commit -m "${commitMessage}"`,
        `git push ${authUrl} HEAD:${branch}`,
      ];

      const { stdout, stderr, exitCode } = await execInContainer(containerId, [
        'bash', '-c', commands.join('\n')
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