// packages/e2e/tests/support/test-api.ts
import type { TestUser, TestOrganization, TestOrganizationDetail, TestProject, TestDraft, TestCard } from './types';

interface ApiResponse<T> {
  code: number;
  data: T;
  error?: string;
}

interface DraftMessagesResponse {
  messages: Array<{
    id: number;
    draftId: number;
    parentId: number | null;
    userId: number;
    userName: string;
    content: string;
    messageType: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
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
    const response = await this.get<ApiResponse<TestUser>>('/auth/me');
    return response.data;
  }

  // === Organization Operations ===

  async getOrganizations(): Promise<TestOrganization[]> {
    const response = await this.get<ApiResponse<TestOrganization[]>>('/organizations');
    return response.data;
  }

  async getOrganizationByName(name: string): Promise<TestOrganization | undefined> {
    const orgs = await this.getOrganizations();
    return orgs.find((o) => o.name === name);
  }

  async getOrganizationById(id: number): Promise<TestOrganizationDetail | undefined> {
    const response = await this.get<ApiResponse<TestOrganizationDetail>>(`/organizations/${id}`);
    return response.data;
  }

  // === Project Operations ===

  async getProjects(): Promise<TestProject[]> {
    const response = await this.get<ApiResponse<TestProject[]>>('/projects');
    return response.data;
  }

  async getProjectByName(name: string): Promise<TestProject | undefined> {
    const projects = await this.getProjects();
    return projects.find((p) => p.name === name);
  }

  async getProjectById(id: number): Promise<TestProject> {
    const response = await this.get<ApiResponse<TestProject>>(`/projects/${id}`);
    return response.data;
  }

  async getProjectStatus(projectId: number): Promise<string> {
    const project = await this.getProjectById(projectId);
    return project.status;
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.delete(`/projects/${projectId}`);
  }

  // === Container Operations ===

  async startContainer(projectId: number): Promise<{ containerId: string; status: string }> {
    const response = await this.post<ApiResponse<{ containerId: string; status: string }>>(`/projects/${projectId}/container/start`);
    return response.data;
  }

  async stopContainer(projectId: number): Promise<{ containerId: string; status: string }> {
    const response = await this.post<ApiResponse<{ containerId: string; status: string }>>(`/projects/${projectId}/container/stop`);
    return response.data;
  }

  async getContainerStatus(projectId: number): Promise<{ containerId: string; status: string }> {
    const response = await this.get<ApiResponse<{ containerId: string; status: string }>>(`/projects/${projectId}/container`);
    return response.data;
  }

  async removeContainer(projectId: number): Promise<void> {
    await this.delete(`/projects/${projectId}/container`);
  }

  // === Draft Operations ===

  async createDraft(params: { projectId: number; title: string }): Promise<TestDraft> {
    const response = await this.post<ApiResponse<TestDraft>>('/drafts', params);
    return response.data;
  }

  async getDraft(draftId: number): Promise<TestDraft> {
    const response = await this.get<ApiResponse<TestDraft>>(`/drafts/${draftId}`);
    return response.data;
  }

  async getDraftCards(draftId: number): Promise<TestCard[]> {
    const response = await this.get<ApiResponse<TestCard[]>>(`/drafts/${draftId}/cards`);
    return response.data;
  }

  async getDraftMessages(draftId: number): Promise<DraftMessagesResponse> {
    const response = await this.get<ApiResponse<DraftMessagesResponse>>(`/drafts/${draftId}/messages`);
    return response.data;
  }

  // === Test Support ===

  async resetDatabase(): Promise<void> {
    await this.postRaw('/test/reset');
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

  private async postRaw(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`POST ${path} failed: ${response.status} ${text}`);
    }
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