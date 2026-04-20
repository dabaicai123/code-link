import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore, type User } from '@/lib/stores/auth-store';
import type { LoginInput, RegisterInput } from '@/lib/validations/auth';

export const authKeys = {
  current: ['currentUser'] as const,
};

export function useCurrentUser() {
  const { user, isAuthenticated } = useAuthStore();
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: authKeys.current(),
    queryFn: () => api.get<User>('/auth/me'),
    enabled: !isAuthenticated,
    retry: false,
  });
}

export function useLogin() {
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<{ token: string; user: User }>('/auth/login', input),
    onSuccess: (data) => {
      setToken(data.token);
      setUser(data.user);
    },
  });
}

export function useRegister() {
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<{ token: string; user: User }>('/auth/register', input),
    onSuccess: (data) => {
      setToken(data.token);
      setUser(data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  return () => {
    logout();
    queryClient.clear();
  };
}
