import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CodeServerStatus } from '@/types/code';

const codeKeys = {
  all: ['code'] as const,
  serverStatus: (projectId: number) => ['code', 'serverStatus', projectId] as const,
};

export function useCodeServerStatus(projectId: number | null) {
  return useQuery<CodeServerStatus>({
    queryKey: codeKeys.serverStatus(projectId!),
    queryFn: () => api.getCodeServerStatus(projectId!),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

export function useStartCodeServer(projectId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.startCodeServer(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}

export function useStopCodeServer(projectId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.stopCodeServer(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}