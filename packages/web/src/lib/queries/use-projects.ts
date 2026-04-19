import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationStore } from '@/lib/stores';

export interface Project {
  id: number;
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  createdAt: string;
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (orgId: number) => [...projectKeys.all, 'list', orgId] as const,
  detail: (id: number) => [...projectKeys.all, 'detail', id] as const,
};

export function useProjects() {
  const currentOrg = useOrganizationStore((s) => s.currentOrganization);

  return useQuery({
    queryKey: projectKeys.list(currentOrg?.id || 0),
    queryFn: () =>
      api.get<Project[]>(`/projects?organizationId=${currentOrg?.id}`),
    enabled: !!currentOrg,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const currentOrg = useOrganizationStore((s) => s.currentOrganization);

  return useMutation({
    mutationFn: (data: {
      name: string;
      templateType: string;
      organizationId: number;
    }) => api.post<Project>('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.list(currentOrg?.id || 0),
      });
    },
  });
}

export function useStartContainer() {
  const queryClient = useQueryClient();
  const currentOrg = useOrganizationStore((s) => s.currentOrganization);

  return useMutation({
    mutationFn: (projectId: number) =>
      api.post(`/projects/${projectId}/container/start`),
    onSuccess: (_, projectId) => {
      // 乐观更新项目状态
      queryClient.setQueryData(
        projectKeys.list(currentOrg?.id || 0),
        (old: Project[] | undefined) =>
          old?.map((p) =>
            p.id === projectId ? { ...p, status: 'running' as const } : p
          )
      );
    },
  });
}

export function useStopContainer() {
  const queryClient = useQueryClient();
  const currentOrg = useOrganizationStore((s) => s.currentOrganization);

  return useMutation({
    mutationFn: (projectId: number) =>
      api.post(`/projects/${projectId}/container/stop`),
    onSuccess: (_, projectId) => {
      queryClient.setQueryData(
        projectKeys.list(currentOrg?.id || 0),
        (old: Project[] | undefined) =>
          old?.map((p) =>
            p.id === projectId ? { ...p, status: 'stopped' as const } : p
          )
      );
    },
  });
}
