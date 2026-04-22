export function isSuperAdmin(userEmail: string): boolean {
  const emails = (process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
  return emails.includes(userEmail);
}

export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
}