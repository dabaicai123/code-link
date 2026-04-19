import type { OrgRole } from "../types.js";

/**
 * 角色层级定义
 * 数值越大权限越高
 */
export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

/**
 * 检查用户角色是否满足要求
 */
export function hasRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * 获取角色的层级值
 */
export function getRoleLevel(role: OrgRole): number {
  return ROLE_HIERARCHY[role];
}
