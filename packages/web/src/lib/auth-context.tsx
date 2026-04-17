'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api, setToken, removeToken, ApiError } from './api';

/**
 * 用户信息
 */
interface User {
  id: string;
  email: string;
  name: string;
}

/**
 * 认证上下文类型
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 认证 Provider 组件
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化时检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await api.get<User>('/auth/me');
        setUser(userData);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await api.post<{ token: string; user: User }>(
        '/auth/login',
        { email, password }
      );
      setToken(response.token);
      setUser(response.user);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '登录失败，请稍后重试';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      setError(null);
      setLoading(true);
      try {
        const response = await api.post<{ token: string; user: User }>(
          '/auth/register',
          { email, name, password }
        );
        setToken(response.token);
        setUser(response.user);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '注册失败，请稍后重试';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
