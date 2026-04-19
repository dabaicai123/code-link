'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuthStore, User } from './stores/auth-store';

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
  const { user, isAuthenticated, setUser, setToken, logout: storeLogout } = useAuthStore();
  const queryClient = useQueryClient();

  // 获取当前用户信息
  const { isLoading, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.get<User>('/auth/me'),
    enabled: !isAuthenticated && !!queryClient.getQueryData(['currentUser']) === false,
    retry: false,
  });

  // 初始化时检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await api.get<User>('/auth/me');
        setUser(userData);
      } catch {
        // 未登录或 token 失效
        setUser(null);
      }
    };

    // 只有在没有用户信息时才检查
    if (!user && !isAuthenticated) {
      checkAuth();
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>(
      '/auth/login',
      { email, password }
    );
    setToken(response.token);
    setUser(response.user);
  };

  const register = async (email: string, name: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>(
      '/auth/register',
      { email, name, password }
    );
    setToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    storeLogout();
    queryClient.clear();
  };

  const clearError = () => {
    // Error is managed by TanStack Query, no-op for compatibility
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: isLoading || (!user && !isAuthenticated),
        error: error?.message || null,
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
