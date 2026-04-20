/**
 * 仓库信息
 */
export interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repoUrl: string;
  repoName: string;
  branch: string;
  cloned: boolean;
  createdAt: string;
}

/**
 * 仓库提供者类型
 */
export type RepoProvider = Repo['provider'];
