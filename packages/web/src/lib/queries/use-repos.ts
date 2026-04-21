import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Repo } from '@/types/repo';

export const repoKeys = {
  all: ['repos'] as const,
  list: (projectId: number) => [...repoKeys.all, 'list', projectId] as const,
};

export function useRepos(projectId: number) {
  return useQuery({
    queryKey: repoKeys.list(projectId),
    queryFn: () => api.getRepos(projectId),
    enabled: !!projectId,
  });
}

export function useAddRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, url }: { projectId: number; url: string }) =>
      api.addRepo(projectId, url),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: repoKeys.list(projectId) });
    },
  });
}

export function useCloneRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, repoId }: { projectId: number; repoId: number }) =>
      api.cloneRepo(projectId, repoId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: repoKeys.list(projectId) });
    },
  });
}

export function useDeleteRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, repoId }: { projectId: number; repoId: number }) =>
      api.deleteRepo(projectId, repoId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: repoKeys.list(projectId) });
    },
  });
}
