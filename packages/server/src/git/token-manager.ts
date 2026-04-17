import type Database from 'better-sqlite3';
import type { Token } from '../types.js';

export class TokenManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  saveToken(
    userId: number,
    provider: 'github' | 'gitlab',
    accessToken: string,
    refreshToken?: string,
    expiresAt?: string
  ): void {
    const existing = this.db
      .prepare('SELECT id FROM tokens WHERE user_id = ? AND provider = ?')
      .get(userId, provider);

    if (existing) {
      this.db
        .prepare('UPDATE tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND provider = ?')
        .run(accessToken, refreshToken || null, expiresAt || null, userId, provider);
    } else {
      this.db
        .prepare('INSERT INTO tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(userId, provider, accessToken, refreshToken || null, expiresAt || null);
    }
  }

  getToken(userId: number, provider: 'github' | 'gitlab'): Token | null {
    const result = this.db
      .prepare('SELECT * FROM tokens WHERE user_id = ? AND provider = ?')
      .get(userId, provider);
    return result ? (result as Token) : null;
  }

  deleteToken(userId: number, provider: 'github' | 'gitlab'): void {
    this.db
      .prepare('DELETE FROM tokens WHERE user_id = ? AND provider = ?')
      .run(userId, provider);
  }

  hasToken(userId: number, provider: 'github' | 'gitlab'): boolean {
    return this.getToken(userId, provider) !== null;
  }

  isTokenExpired(token: Token): boolean {
    if (!token.expires_at) return false;

    const expiresAt = new Date(token.expires_at);
    const now = new Date();

    // 提前 5 分钟视为过期
    return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
  }
}
