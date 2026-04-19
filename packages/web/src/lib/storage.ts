const TOKEN_KEY = 'token';
const ORG_ID_KEY = 'currentOrganizationId';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export const storage = {
  getToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
  },

  getOrgId(): number | null {
    if (!isBrowser()) return null;
    const id = localStorage.getItem(ORG_ID_KEY);
    return id ? parseInt(id, 10) : null;
  },

  setOrgId(id: number): void {
    if (!isBrowser()) return;
    localStorage.setItem(ORG_ID_KEY, String(id));
  },

  removeOrgId(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ORG_ID_KEY);
  },

  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_ID_KEY);
  },
};