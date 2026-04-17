import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.js';
import { TokenManager } from '../src/git/token-manager.js';

describe('TokenManager', () => {
  let db: Database.Database;
  let manager: TokenManager;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    manager = new TokenManager(db);
  });

  it('should save token', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');

    const token = manager.getToken(1, 'github');
    expect(token?.access_token).toBe('gh_token');
  });

  it('should update existing token', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');
    manager.saveToken(1, 'github', 'new_gh_token', 'new_gh_refresh', '2025-02-01T00:00:00Z');

    const token = manager.getToken(1, 'github');
    expect(token?.access_token).toBe('new_gh_token');
  });

  it('should delete token', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');
    manager.deleteToken(1, 'github');

    const token = manager.getToken(1, 'github');
    expect(token).toBeNull();
  });

  it('should check if token exists', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');

    expect(manager.hasToken(1, 'github')).toBe(true);
    expect(manager.hasToken(1, 'gitlab')).toBe(false);
  });
});
