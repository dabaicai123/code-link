'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuthStore, User } from './stores/auth-store';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, setUser, setToken, logout: storeLogout } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch current user info using TanStack Query
  const { isLoading, error, data } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.get<User>('/auth/me'),
    enabled: !isAuthenticated,
    retry: false,
  });

  // Update store when query returns user data
  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

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
        loading: isLoading && !isAuthenticated,
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
