// src/git/gitlab-client.ts
export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  default_branch: string;
}

export interface GitLabBranch {
  name: string;
}

export class GitLabClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string = 'https://gitlab.com', accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  private getHeaders(): Record<string, string> {
    return {
      'PRIVATE-TOKEN': this.accessToken,
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

  async getProjectByPath(path: string): Promise<GitLabProject> {
    const encodedPath = encodeURIComponent(path);
    return this.request<GitLabProject>(`/projects/${encodedPath}`);
  }
}