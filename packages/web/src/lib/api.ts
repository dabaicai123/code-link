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
  created_at: string;
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
};
