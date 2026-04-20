/**
 * API 错误类
 */
export class ApiError extends Error {
  status: number;
  code: number;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * API 客户端配置
 */
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

const API_BASE = '/api';

import { storage } from './storage';
import type {
  Draft,
  DraftMember,
  DraftMessage,
  CreateDraftInput,
  SendMessageInput,
  DraftStatus,
  ConfirmationType,
} from '@/types/draft';

// 导入统一类型
import type { OrgRole } from '@/types/user';
import type { Organization, OrganizationDetail, OrganizationMember } from '@/types/organization';
import type { Repo } from '@/types/repo';
import type { OrganizationInvitation } from '@/types/invitation';

// 重新导出类型以保持向后兼容
export type { OrgRole } from '@/types/user';
export type { Organization, OrganizationDetail, OrganizationMember } from '@/types/organization';
export type { Repo } from '@/types/repo';
export type { OrganizationInvitation } from '@/types/invitation';

/**
 * 从 localStorage 获取 token
 */
function getToken(): string | null {
  return storage.getToken();
}

/**
 * 保存 token 到 localStorage
 */
export function setToken(token: string): void {
  storage.setToken(token);
}

/**
 * 移除 token
 */
export function removeToken(): void {
  storage.removeToken();
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
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorMessage = '请求失败';
    let errorCode = 10001;
    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || errorCode;
      } catch {
        // ignore
      }
    }
    throw new ApiError(response.status, errorCode, errorMessage);
  }

  // 处理空响应
  if (!isJson) {
    return {} as T;
  }

  const result = await response.json();

  // 适配新格式：直接返回 data 字段
  // 兼容旧格式：如果 code 不存在，直接返回结果
  if (result.code === 0 && 'data' in result) {
    return result.data as T;
  }

  return result as T;
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

  // Draft 相关 API
  createDraft: (input: CreateDraftInput): Promise<{ draft: Draft }> =>
    apiClient<{ draft: Draft }>('/drafts', { method: 'POST', body: JSON.stringify(input) }),

  getDrafts: (projectId?: number): Promise<{ drafts: Draft[] }> => {
    const url = projectId ? `/drafts?projectId=${projectId}` : '/drafts';
    return apiClient<{ drafts: Draft[] }>(url, { method: 'GET' });
  },

  getDraft: (draftId: number): Promise<{ draft: Draft; members: DraftMember[] }> =>
    apiClient<{ draft: Draft; members: DraftMember[] }>(`/drafts/${draftId}`, { method: 'GET' }),

  updateDraftStatus: (draftId: number, status: DraftStatus): Promise<{ draft: Draft }> =>
    apiClient<{ draft: Draft }>(`/drafts/${draftId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  deleteDraft: (draftId: number): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}`, { method: 'DELETE' }),

  addDraftMember: (draftId: number, userId: number): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeDraftMember: (draftId: number, userId: number): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}/members/${userId}`, { method: 'DELETE' }),

  getDraftMessages: (
    draftId: number,
    options?: { parentId?: number; limit?: number; before?: string }
  ): Promise<{ messages: DraftMessage[] }> => {
    const params = new URLSearchParams();
    if (options?.parentId !== undefined) {
      params.set('parentId', String(options.parentId));
    }
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.before) {
      params.set('before', options.before);
    }
    const query = params.toString();
    return apiClient<{ messages: DraftMessage[] }>(`/drafts/${draftId}/messages${query ? `?${query}` : ''}`);
  },

  sendDraftMessage: (draftId: number, input: SendMessageInput): Promise<{ message: DraftMessage }> =>
    apiClient<{ message: DraftMessage }>(`/drafts/${draftId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  confirmDraftMessage: (
    draftId: number,
    messageId: number,
    type: ConfirmationType,
    comment?: string
  ): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}/messages/${messageId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ type, comment }),
    }),

  getDraftMessageConfirmations: (
    draftId: number,
    messageId: number
  ): Promise<{ confirmations: Array<{ userId: number; userName: string; type: string; comment: string | null }> }> =>
    apiClient(`/drafts/${draftId}/messages/${messageId}/confirmations`),
};
