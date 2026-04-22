const SUPER_ADMIN_EMAILS: Set<string> = new Set(
  (process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
);

export function isSuperAdmin(userEmail: string): boolean {
  return SUPER_ADMIN_EMAILS.has(userEmail);
}

export function getSuperAdminEmails(): string[] {
  return [...SUPER_ADMIN_EMAILS];
}