import type { OrgRole } from '../../db/schema/index.js';

export interface OrganizationWithRole {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  role: OrgRole;
}

export interface OrganizationMemberWithUser {
  userId: number;
  userName: string;
  userEmail: string;
  role: OrgRole;
  joinedAt: string;
}

export interface OrganizationInvitationWithUser {
  id: number;
  email: string;
  role: OrgRole;
  invitedBy: number;
  invitedByName: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface OrganizationDetail {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  members: OrganizationMemberWithUser[];
}
