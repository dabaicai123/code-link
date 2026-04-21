import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OrganizationInvitation } from '@/types/invitation';
import type { OrgRole } from '@/types/user';
import { organizationKeys } from './use-organizations';

export const invitationKeys = {
  all: ['invitations'] as const,
  my: () => [...invitationKeys.all, 'my'] as const,
  org: (orgId: number) => [...invitationKeys.all, 'org', orgId] as const,
};

export function useMyInvitations() {
  return useQuery({
    queryKey: invitationKeys.my(),
    queryFn: () => api.getMyInvitations(),
  });
}

export function useOrganizationInvitations(orgId: number) {
  return useQuery({
    queryKey: invitationKeys.org(orgId),
    queryFn: () => api.getOrganizationInvitations(orgId),
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      email,
      role,
    }: {
      orgId: number;
      email: string;
      role: OrgRole;
    }) => api.inviteMember(orgId, email, role),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.org(orgId) });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invId: number) => api.acceptInvitation(invId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.my() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invId: number) => api.declineInvitation(invId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.my() });
    },
  });
}
