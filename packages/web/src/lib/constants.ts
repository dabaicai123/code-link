// packages/web/src/lib/constants.ts

import type { OrgRole } from '@/types/user';

// 角色标签
export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  developer: 'Developer',
  member: 'Member',
};

// 角色颜色
export const ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'var(--accent-color)',
  developer: 'var(--status-success)',
  member: 'var(--text-secondary)',
};

// 角色选项
export const ROLE_OPTIONS: OrgRole[] = ['owner', 'developer', 'member'];

// 角色层级（用于权限比较）
export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};
