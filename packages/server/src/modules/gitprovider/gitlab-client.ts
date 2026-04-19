// src/modules/gitprovider/gitlab-client.ts
import type { GitLabProject, GitLabBranch } from './types.js';

export class GitLabClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/v4${path}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUserProjects(): Promise<GitLabProject[]> {
    return this.request<GitLabProject[]>('/projects?membership=true&per_page=100');
  }

  async getProject(projectId: number): Promise<GitLabProject> {
    return this.request<GitLabProject>(`/projects/${projectId}`);
  }

  async getProjectBranches(projectId: number): Promise<GitLabBranch[]> {
    return this.request<GitLabBranch[]>(`/projects/${projectId}/repository/branches`);
  }
}