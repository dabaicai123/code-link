export type GitProvider = 'github' | 'gitlab';

export interface OAuthConfig {
  githubClientId: string;
  githubClientSecret: string;
  gitlabClientId: string;
  gitlabClientSecret: string;
  gitlabBaseUrl: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
}

export interface GitHubBranch {
  name: string;
}

export interface GitHubWebhook {
  id: number;
  url: string;
  active: boolean;
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  default_branch: string;
  visibility: string;
}

export interface GitLabBranch {
  name: string;
}

export interface ProviderStatus {
  provider: GitProvider;
  authorized: boolean;
}

export interface CloneResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface PushResult {
  success: boolean;
  error?: string;
}