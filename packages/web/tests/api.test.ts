import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, apiClient, setToken, removeToken } from '../src/lib/api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Layer', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  describe('ApiError', () => {
    it('should create an ApiError with status and message', () => {
      const error = new ApiError(404, 'Not Found');
      expect(error.status).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('Token management', () => {
    it('should set and get token from localStorage', () => {
      setToken('test-token');
      expect(localStorageMock.getItem('token')).toBe('test-token');
    });

    it('should remove token from localStorage', () => {
      setToken('test-token');
      removeToken();
      expect(localStorageMock.getItem('token')).toBeNull();
    });
  });

  describe('apiClient', () => {
    it('should make a successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await apiClient('/test');
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });

    it('should add Authorization header when token exists', async () => {
      setToken('my-auth-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiClient('/protected');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toMatchObject({
        Authorization: 'Bearer my-auth-token',
      });
    });

    it('should skip Authorization header when skipAuth is true', async () => {
      setToken('my-auth-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiClient('/public', { skipAuth: true });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).not.toHaveProperty('Authorization');
    });

    it('should throw ApiError on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      try {
        await apiClient('/auth/login');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
        expect((error as ApiError).message).toBe('Invalid credentials');
      }
    });

    it('should send POST request with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      await apiClient('/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'John' }),
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify({ name: 'John' }));
    });
  });
});
