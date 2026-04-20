/**
 * 用户信息
 */
export interface User {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
}

/**
 * 组织角色
 */
export type OrgRole = 'owner' | 'developer' | 'member';
