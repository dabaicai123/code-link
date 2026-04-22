import { apiClient, ApiError, apiClientMethods, setToken, removeToken } from './api-client';

import type {
  Draft,
  DraftMember,
  DraftMessage,
  CreateDraftInput,
  SendMessageInput,
  DraftStatus,
  ConfirmationType,
} from '@/types/draft';
import type { OrgRole } from '@/types/user';
import type { Organization, OrganizationDetail, OrganizationMember } from '@/types/organization';
import type { Repo } from '@/types/repo';
import type { OrganizationInvitation } from '@/types/invitation';
import type { Card } from '@/types/card';
import type { RepoGitStatus, CommitNode, BranchInfo, FileContent, FileTreeNode } from '@/types/code';

export { ApiError, setToken, removeToken };

export const api = {
  ...apiClientMethods,

  // 仓库相关 API
  addRepo: (projectId: number, url: string): Promise<Repo> =>
    apiClient<Repo>(`/projects/${projectId}/repos`, { method: 'POST', body: JSON.stringify({ url }) }),

  getRepos: (projectId: number): Promise<Repo[]> =>
    apiClient<Repo[]>(`/projects/${projectId}/repos`, { method: 'GET' }),

  deleteRepo: (projectId: number, repoId: number): Promise<void> =>
    apiClient<void>(`/projects/${projectId}/repos/${repoId}`, { method: 'DELETE' }),

  cloneRepo: (projectId: number, repoId: number): Promise<{ path: string }> =>
    apiClient<{ path: string }>(`/projects/${projectId}/repos/${repoId}/clone`, { method: 'POST', body: JSON.stringify({}) }),

  pushRepo: (projectId: number, repoId: number, message: string): Promise<void> =>
    apiClient<void>(`/projects/${projectId}/repos/${repoId}/push`, { method: 'POST', body: JSON.stringify({ message }) }),

  // 组织相关 API
  getOrganizations: (): Promise<Organization[]> =>
    apiClient<Organization[]>('/organizations', { method: 'GET' }),

  getOrganization: (orgId: number): Promise<OrganizationDetail> =>
    apiClient<OrganizationDetail>(`/organizations/${orgId}`, { method: 'GET' }),

  createOrganization: (name: string): Promise<Organization> =>
    apiClient<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name }) }),

  updateOrganization: (orgId: number, name: string): Promise<Organization> =>
    apiClient<Organization>(`/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify({ name }) }),

  deleteOrganization: (orgId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}`, { method: 'DELETE' }),

  // 组织成员相关 API
  updateMemberRole: (orgId: number, userId: number, role: OrgRole): Promise<OrganizationMember> =>
    apiClient<OrganizationMember>(`/organizations/${orgId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeMember: (orgId: number, userId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' }),

  // 组织邀请相关 API
  inviteMember: (orgId: number, email: string, role: OrgRole): Promise<OrganizationInvitation> =>
    apiClient<OrganizationInvitation>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  getOrganizationInvitations: (orgId: number): Promise<OrganizationInvitation[]> =>
    apiClient<OrganizationInvitation[]>(`/organizations/${orgId}/invitations`, { method: 'GET' }),

  cancelInvitation: (orgId: number, invId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}/invitations/${invId}`, { method: 'DELETE' }),

  // 用户邀请相关 API
  getMyInvitations: (): Promise<OrganizationInvitation[]> =>
    apiClient<OrganizationInvitation[]>('/invitations', { method: 'GET' }),

  acceptInvitation: (invId: number): Promise<{ organization: Organization; member: OrganizationMember }> =>
    apiClient<{ organization: Organization; member: OrganizationMember }>(`/invitations/${invId}`, {
      method: 'POST',
    }),

  declineInvitation: (invId: number): Promise<void> =>
    apiClient<void>(`/invitations/${invId}`, { method: 'DELETE' }),

  // Draft 相关 API
  createDraft: (input: CreateDraftInput): Promise<{ draft: Draft }> =>
    apiClient<{ draft: Draft }>('/drafts', { method: 'POST', body: JSON.stringify(input) }),

  getDrafts: (projectId?: number): Promise<{ drafts: Draft[] }> => {
    const url = projectId ? `/drafts?projectId=${projectId}` : '/drafts';
    return apiClient<{ drafts: Draft[] }>(url, { method: 'GET' });
  },

  getDraft: (draftId: number): Promise<{ draft: Draft; members: DraftMember[] }> =>
    apiClient<{ draft: Draft; members: DraftMember[] }>(`/drafts/${draftId}`, { method: 'GET' }),

  updateDraftStatus: (draftId: number, status: DraftStatus): Promise<{ draft: Draft }> =>
    apiClient<{ draft: Draft }>(`/drafts/${draftId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  deleteDraft: (draftId: number): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}`, { method: 'DELETE' }),

  addDraftMember: (draftId: number, userId: number): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeDraftMember: (draftId: number, userId: number): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}/members/${userId}`, { method: 'DELETE' }),

  getDraftMessages: (
    draftId: number,
    options?: { parentId?: number; limit?: number; before?: string }
  ): Promise<{ messages: DraftMessage[] }> => {
    const params = new URLSearchParams();
    if (options?.parentId !== undefined) params.set('parentId', String(options.parentId));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    const query = params.toString();
    return apiClient<{ messages: DraftMessage[] }>(`/drafts/${draftId}/messages${query ? `?${query}` : ''}`);
  },

  sendDraftMessage: (draftId: number, input: SendMessageInput): Promise<{ message: DraftMessage }> =>
    apiClient<{ message: DraftMessage }>(`/drafts/${draftId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  confirmDraftMessage: (
    draftId: number,
    messageId: number,
    type: ConfirmationType,
    comment?: string
  ): Promise<{ success: boolean }> =>
    apiClient<{ success: boolean }>(`/drafts/${draftId}/messages/${messageId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ type, comment }),
    }),

  getDraftMessageConfirmations: (
    draftId: number,
    messageId: number
  ): Promise<{ confirmations: Array<{ userId: number; userName: string; type: string; comment: string | null }> }> =>
    apiClient(`/drafts/${draftId}/messages/${messageId}/confirmations`),

  // Card 相关 API
  getDraftCards: (draftId: number): Promise<{ cards: Card[] }> =>
    apiClient<{ cards: Card[] }>(`/drafts/${draftId}/cards`, { method: 'GET' }),

  // Skills 相关 API
  getSkills: (): Promise<{ skills: Array<{ name: string; description: string }> }> =>
    apiClient<{ skills: Array<{ name: string; description: string }> }>('/skills'),

  // ─── Code tab ────────────────────────────────────────────────
  getCodeFileTree: (projectId: number, repoName?: string) =>
    apiClient<FileTreeNode[]>(`/projects/${projectId}/code/tree${repoName ? `?repoName=${repoName}` : ''}`),

  getCodeFileContent: (projectId: number, path: string, repoName?: string) =>
    apiClient<FileContent>(`/projects/${projectId}/code/file?path=${encodeURIComponent(path)}${repoName ? `&repoName=${repoName}` : ''}`),

  getCodeGitStatus: (projectId: number) =>
    apiClient<RepoGitStatus[]>(`/projects/${projectId}/code/git/status`),

  getCodeGitLog: (projectId: number, repoName?: string) =>
    apiClient<CommitNode[]>(`/projects/${projectId}/code/git/log${repoName ? `?repoName=${repoName}` : ''}`),

  getCodeBranches: (projectId: number, repoName?: string) =>
    apiClient<BranchInfo[]>(`/projects/${projectId}/code/git/branches${repoName ? `?repoName=${repoName}` : ''}`),

  getCodeCommitDiff: (projectId: number, hash: string, repoName?: string) =>
    apiClient<{ diff: string }>(`/projects/${projectId}/code/git/diff?hash=${hash}${repoName ? `&repoName=${repoName}` : ''}`),

  codeGitCommit: (projectId: number, message: string, repoName?: string) =>
    apiClient<{ success: boolean; hash?: string }>(`/projects/${projectId}/code/git/commit`, { method: 'POST', body: JSON.stringify({ message, repoName }) }),

  codeGitPush: (projectId: number, repoName?: string) =>
    apiClient<{ success: boolean }>(`/projects/${projectId}/code/git/push`, { method: 'POST', body: JSON.stringify({ repoName }) }),

  codeGitPull: (projectId: number, repoName?: string) =>
    apiClient<{ success: boolean }>(`/projects/${projectId}/code/git/pull`, { method: 'POST', body: JSON.stringify({ repoName }) }),

  codeGitStage: (projectId: number, repoName: string, paths: string[]) =>
    apiClient<{ success: boolean }>(`/projects/${projectId}/code/git/stage`, { method: 'POST', body: JSON.stringify({ repoName, paths }) }),

  codeGitDiscard: (projectId: number, repoName: string, paths: string[]) =>
    apiClient<{ success: boolean }>(`/projects/${projectId}/code/git/discard`, { method: 'POST', body: JSON.stringify({ repoName, paths }) }),
};