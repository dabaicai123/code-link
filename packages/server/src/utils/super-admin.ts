import { getConfig } from '../core/config.js';

export function isSuperAdmin(userEmail: string): boolean {
  const adminEmails = getConfig().adminEmails;
  return adminEmails?.includes(userEmail) ?? false;
}

export function getSuperAdminEmails(): string[] {
  return getConfig().adminEmails ?? [];
}