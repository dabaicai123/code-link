import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { User } from '@/types';
import type { LoginInput, RegisterInput } from '@/lib/validations/auth';

export const authKeys = {
  current: ['currentUser'] as const,
};

export function useCurrentUser() {
  const { user, token, initialized } = useAuthStore();
  const setAuth = useAuthStore((s) => s.setAuth);

  const query = useQuery({
    queryKey: authKeys.current,
    queryFn: async () => {
      const user = await api.get<User>('/auth/me');
      // Update auth store with user info
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        setAuth(currentToken, user);
      }
      return user;
    },
    enabled: !!token && !user, // Only fetch if we have token but no user
    retry: false,
  });

  return {
    ...query,
    isLoading: !initialized || query.isLoading,
  };
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<{ token: string; user: User }>('/auth/login', input),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<{ token: string; user: User }>('/auth/register', input),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
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
