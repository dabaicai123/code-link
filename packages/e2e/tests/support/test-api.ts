// packages/e2e/tests/support/test-api.ts
import type { TestUser, TestOrganization, TestProject } from './types';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

export class TestApi {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // === User Operations ===

  async getCurrentUser(): Promise<TestUser> {
    const response = await this.get<ApiResponse<{ user: TestUser }>>('/auth/me');
    return response.data.user;
  }

  // === Organization Operations ===

  async getOrganizations(): Promise<TestOrganization[]> {
    const response = await this.get<ApiResponse<{ organizations: TestOrganization[] }>>('/organizations');
    return response.data.organizations;
  }

  async getOrganizationByName(name: string): Promise<TestOrganization | undefined> {
    const orgs = await this.getOrganizations();
    return orgs.find((o) => o.name === name);
  }

  async getOrganizationById(id: number): Promise<TestOrganization | undefined> {
    const response = await this.get<ApiResponse<{ organization: TestOrganization }>>(`/organizations/${id}`);
    return response.data.organization;
  }

  // === Project Operations ===

  async getProjects(): Promise<TestProject[]> {
    const response = await this.get<ApiResponse<{ projects: TestProject[] }>>('/projects');
    return response.data.projects;
  }

  async getProjectByName(name: string): Promise<TestProject | undefined> {
    const projects = await this.getProjects();
    return projects.find((p) => p.name === name);
  }

  async getProjectById(id: number): Promise<TestProject> {
    const response = await this.get<ApiResponse<{ project: TestProject }>>(`/projects/${id}`);
    return response.data.project;
  }

  async getProjectStatus(projectId: number): Promise<string> {
    const project = await this.getProjectById(projectId);
    return project.status;
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.delete(`/projects/${projectId}`);
  }

  // === Low-level HTTP Methods ===

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  private async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DELETE ${path} failed: ${response.status} ${text}`);
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${text}`);
    }
    return response.json();
  }
}