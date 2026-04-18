// packages/server/src/utils/super-admin.ts

/**
 * 检查用户是否为超级管理员
 * 通过环境变量 SUPER_ADMIN_EMAILS 配置，多个邮箱用逗号分隔
 */
export function isSuperAdmin(userEmail: string): boolean {
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return superAdminEmails.includes(userEmail);
}

/**
 * 获取超级管理员邮箱列表
 */
export function getSuperAdminEmails(): string[] {
  return process.env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
}
