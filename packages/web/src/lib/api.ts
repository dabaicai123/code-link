/**
 * API 错误类
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * API 客户端配置
 */
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

const API_BASE = '/api';

/**
 * 从 localStorage 获取 token
 */
function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('token');
}

/**
 * 保存 token 到 localStorage
 */
export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
}

/**
 * 移除 token
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}

/**
 * API 客户端函数
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // 自动添加 Authorization header
  if (!skipAuth) {
    const token = getToken();
    if (token) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  // 处理响应
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(response.status, errorMessage);
  }

  // 处理空响应
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return {} as T;
}

/**
 * 仓库信息
 */
export interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repo_url: string;
  repo_name: string;
  branch: string;
  cloned: boolean;
  created_at: string;
}

/**
 * 组织信息
 */
export interface Organization {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  role?: OrgRole;
}

/**
 * 组织角色
 */
export type OrgRole = 'owner' | 'developer' | 'member';

/**
 * 组织成员
 */
export interface OrganizationMember {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: OrgRole;
  joined_at: string;
}

/**
 * 组织邀请
 */
export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  organization_name?: string;
  email: string;
  role: OrgRole;
  invited_by: number;
  invited_by_name?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

/**
 * 组织详情（包含成员列表）
 */
export interface OrganizationDetail extends Organization {
  members: OrganizationMember[];
}

// 便捷方法
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),

  // 仓库相关 API
  addRepo: (projectId: number, url: string): Promise<Repo> =>
    apiClient<Repo>(`/projects/${projectId}/repos`, { method: 'POST', body: JSON.stringify({ url }) }),

  getRepos: (projectId: number): Promise<Repo[]> =>
    apiClient<Repo[]>(`/projects/${projectId}/repos`, { method: 'GET' }),

  deleteRepo: (projectId: number, repoId: number): Promise<void> =>
    apiClient<void>(`/projects/${projectId}/repos/${repoId}`, { method: 'DELETE' }),

  cloneRepo: (projectId: number, repoId: number): Promise<{ path: string }> =>
    apiClient<{ path: string }>(`/projects/${projectId}/repos/${repoId}/clone`, { method: 'POST', body: JSON.stringify({}) }),

  pushRepo: (projectId: number, repoId: number, message: string): Promise<void> =>
    apiClient<void>(`/projects/${projectId}/repos/${repoId}/push`, { method: 'POST', body: JSON.stringify({ message }) }),

  // 组织相关 API
  getOrganizations: (): Promise<Organization[]> =>
    apiClient<Organization[]>('/organizations', { method: 'GET' }),

  getOrganization: (orgId: number): Promise<OrganizationDetail> =>
    apiClient<OrganizationDetail>(`/organizations/${orgId}`, { method: 'GET' }),

  createOrganization: (name: string): Promise<Organization> =>
    apiClient<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name }) }),

  updateOrganization: (orgId: number, name: string): Promise<Organization> =>
    apiClient<Organization>(`/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify({ name }) }),

  deleteOrganization: (orgId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}`, { method: 'DELETE' }),

  // 组织成员相关 API
  updateMemberRole: (orgId: number, userId: number, role: OrgRole): Promise<OrganizationMember> =>
    apiClient<OrganizationMember>(`/organizations/${orgId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeMember: (orgId: number, userId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' }),

  // 组织邀请相关 API
  inviteMember: (orgId: number, email: string, role: OrgRole): Promise<OrganizationInvitation> =>
    apiClient<OrganizationInvitation>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  getOrganizationInvitations: (orgId: number): Promise<OrganizationInvitation[]> =>
    apiClient<OrganizationInvitation[]>(`/organizations/${orgId}/invitations`, { method: 'GET' }),

  cancelInvitation: (orgId: number, invId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}/invitations/${invId}`, { method: 'DELETE' }),

  // 用户邀请相关 API
  getMyInvitations: (): Promise<OrganizationInvitation[]> =>
    apiClient<OrganizationInvitation[]>('/invitations', { method: 'GET' }),

  acceptInvitation: (invId: number): Promise<{ organization: Organization; member: OrganizationMember }> =>
    apiClient<{ organization: Organization; member: OrganizationMember }>(`/invitations/${invId}`, {
      method: 'POST',
    }),

  declineInvitation: (invId: number): Promise<void> =>
    apiClient<void>(`/invitations/${invId}`, { method: 'DELETE' }),
};
