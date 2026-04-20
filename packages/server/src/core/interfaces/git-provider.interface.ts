export interface GitRepo {
  id: number | string;
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GitBranch {
  name: string;
}

export interface GitWebhook {
  id: number | string;
  url: string;
  active: boolean;
}

export interface IGitProvider {
  getUserRepos(): Promise<GitRepo[]>;
  getRepo(owner: string, repo: string): Promise<GitRepo>;
  getBranches(owner: string, repo: string): Promise<GitBranch[]>;
  createWebhook(owner: string, repo: string, webhookUrl: string): Promise<GitWebhook>;
}