import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Organization, OrganizationDetail } from '@/lib/api';
import { useOrganizationStore } from '@/lib/stores';

export const organizationKeys = {
  all: ['organizations'] as const,
  list: () => [...organizationKeys.all, 'list'] as const,
  detail: (id: number) => [...organizationKeys.all, 'detail', id] as const,
};

export function useOrganizations() {
  const setOrganizations = useOrganizationStore((s) => s.setOrganizations);

  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: async () => {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);
      return orgs;
    },
  });
}

export function useOrganization(id: number) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => api.getOrganization(id),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const addOrganization = useOrganizationStore((s) => s.addOrganization);

  return useMutation({
    mutationFn: (name: string) => api.createOrganization(name),
    onSuccess: (newOrg) => {
      addOrganization(newOrg);
      queryClient.invalidateQueries({ queryKey: organizationKeys.list() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const updateOrganization = useOrganizationStore((s) => s.updateOrganization);

  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.updateOrganization(id, name),
    onSuccess: (updatedOrg) => {
      updateOrganization(updatedOrg.id, updatedOrg);
      queryClient.invalidateQueries({ queryKey: organizationKeys.list() });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  const removeOrganization = useOrganizationStore((s) => s.removeOrganization);

  return useMutation({
    mutationFn: (id: number) => api.deleteOrganization(id),
    onSuccess: (_, id) => {
      removeOrganization(id);
      queryClient.invalidateQueries({ queryKey: organizationKeys.list() });
    },
  });
}
