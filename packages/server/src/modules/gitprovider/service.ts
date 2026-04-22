import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { GitProviderRepository } from './repository.js';
import { GitHubClient } from './github-client.js';
import { GitLabClient } from './gitlab-client.js';
import {
  getOAuthConfig,
  getGitHubOAuthUrl,
  getGitLabOAuthUrl,
  exchangeGitHubCode,
  exchangeGitLabCode,
} from './oauth.js';
import type { GitProvider, ProviderStatus, GitHubRepo, GitLabProject } from './types.js';

@singleton()
export class GitProviderService {
  constructor(
    @inject(GitProviderRepository) private readonly repo: GitProviderRepository
  ) {}

  private async getAuthorizedToken(userId: number, provider: GitProvider): Promise<string> {
    const token = await this.repo.findByUserAndProvider(userId, provider);
    if (!token) {
      throw new Error(`${provider === 'github' ? 'GitHub' : 'GitLab'} 未授权`);
    }
    return token.accessToken;
  }

  private async getGitHubClient(userId: number): Promise<GitHubClient> {
    return new GitHubClient(await this.getAuthorizedToken(userId, 'github'));
  }

  private async getGitLabClient(userId: number): Promise<GitLabClient> {
    const config = getOAuthConfig();
    return new GitLabClient(config.gitlabBaseUrl, await this.getAuthorizedToken(userId, 'gitlab'));
  }

  getOAuthUrl(provider: GitProvider): string {
    const config = getOAuthConfig();
    return provider === 'github' ? getGitHubOAuthUrl(config) : getGitLabOAuthUrl(config);
  }

  async handleOAuthCallback(provider: GitProvider, code: string, userId: number): Promise<void> {
    const config = getOAuthConfig();
    const tokenResponse = provider === 'github'
      ? await exchangeGitHubCode(config, code)
      : await exchangeGitLabCode(config, code);

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined;

    await this.repo.upsert({
      userId,
      provider,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    });
  }

  async getAuthorizationStatus(userId: number): Promise<{ github: ProviderStatus; gitlab: ProviderStatus }> {
    const [githubAuthorized, gitlabAuthorized] = await Promise.all([
      this.repo.hasToken(userId, 'github'),
      this.repo.hasToken(userId, 'gitlab'),
    ]);

    return {
      github: { provider: 'github', authorized: githubAuthorized },
      gitlab: { provider: 'gitlab', authorized: gitlabAuthorized },
    };
  }

  async revokeAuthorization(userId: number, provider: GitProvider): Promise<void> {
    await this.repo.delete(userId, provider);
  }

  async getGitHubRepos(userId: number): Promise<GitHubRepo[]> {
    const client = await this.getGitHubClient(userId);
    return client.getUserRepos();
  }

  async getGitHubRepo(userId: number, owner: string, repo: string): Promise<GitHubRepo> {
    const client = await this.getGitHubClient(userId);
    return client.getRepo(owner, repo);
  }

  async getGitHubBranches(userId: number, owner: string, repo: string) {
    const client = await this.getGitHubClient(userId);
    return client.getRepoBranches(owner, repo);
  }

  async createGitHubWebhook(userId: number, owner: string, repo: string, webhookUrl: string) {
    const client = await this.getGitHubClient(userId);
    return client.createWebhook(owner, repo, webhookUrl);
  }

  async getGitLabProjects(userId: number): Promise<GitLabProject[]> {
    const client = await this.getGitLabClient(userId);
    return client.getUserProjects();
  }

  async getGitLabProject(userId: number, projectId: number): Promise<GitLabProject> {
    const client = await this.getGitLabClient(userId);
    return client.getProject(projectId);
  }

  async getGitLabBranches(userId: number, projectId: number) {
    const client = await this.getGitLabClient(userId);
    return client.getProjectBranches(projectId);
  }

  async getToken(userId: number, provider: GitProvider): Promise<string | null> {
    const token = await this.repo.findByUserAndProvider(userId, provider);
    return token?.accessToken ?? null;
  }
}