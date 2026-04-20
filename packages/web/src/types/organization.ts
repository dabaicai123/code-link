import type { OrgRole } from './user';

/**
 * 组织信息
 */
export interface Organization {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  role?: OrgRole;
}

/**
 * 组织成员
 */
export interface OrganizationMember {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: OrgRole;
  joinedAt: string;
}

/**
 * 组织详情（包含成员列表）
 */
export interface OrganizationDetail extends Organization {
  members: OrganizationMember[];
}
