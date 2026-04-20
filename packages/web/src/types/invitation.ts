import type { OrgRole } from './user';

/**
 * 组织邀请
 */
export interface OrganizationInvitation {
  id: number;
  organizationId: number;
  organizationName?: string;
  email: string;
  role: OrgRole;
  invitedBy: number;
  invitedByName?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

/**
 * 邀请状态
 */
export type InvitationStatus = OrganizationInvitation['status'];
