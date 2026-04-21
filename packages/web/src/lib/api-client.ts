import { storage } from './storage';

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

export interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

const API_BASE = '/api';

function getToken(): string | null {
  return storage.getToken();
}

export function setToken(token: string): void {
  storage.setToken(token);
}

export function removeToken(): void {
  storage.removeToken();
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

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

  if (!isJson) {
    return {} as T;
  }

  const result = await response.json();

  if (result.code === 0 && 'data' in result) {
    return result.data as T;
  }

  return result as T;
}

export const apiClientMethods = {
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
};