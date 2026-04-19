// src/modules/gitprovider/github-client.ts
import type { GitHubRepo, GitHubBranch, GitHubWebhook } from './types.js';

const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeLink-App',
    };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async post<T>(path: string, body: object): Promise<T> {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUserRepos(): Promise<GitHubRepo[]> {
    return this.request<GitHubRepo[]>('/user/repos?per_page=100');
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  async getRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.request<GitHubBranch[]>(`/repos/${owner}/${repo}/branches`);
  }

  async createWebhook(owner: string, repo: string, webhookUrl: string): Promise<GitHubWebhook> {
    return this.post<GitHubWebhook>(`/repos/${owner}/${repo}/hooks`, {
      name: 'web',
      active: true,
      events: ['push', 'pull_request'],
      config: {
        url: webhookUrl,
        content_type: 'json',
      },
    });
  }
}