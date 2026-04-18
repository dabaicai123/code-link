import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSchema } from '../src/db/schema.js';
import { TokenManager } from '../src/git/token-manager.js';
import { getSqliteDb } from '../src/db/index.js';
import type Database from 'better-sqlite3';

describe('TokenManager', () => {
  let db: Database.Database;
  let manager: TokenManager;

  beforeEach(async () => {
    db = getSqliteDb(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    manager = new TokenManager();
  });

  afterEach(() => {
    db.close();
  });

  it('should save token', async () => {
    await manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');

    const token = await manager.getToken(1, 'github');
    expect(token?.accessToken).toBe('gh_token');
  });

  it('should update existing token', async () => {
    await manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');
    await manager.saveToken(1, 'github', 'new_gh_token', 'new_gh_refresh', '2025-02-01T00:00:00Z');

    const token = await manager.getToken(1, 'github');
    expect(token?.accessToken).toBe('new_gh_token');
  });

  it('should delete token', async () => {
    await manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');
    await manager.deleteToken(1, 'github');

    const token = await manager.getToken(1, 'github');
    expect(token).toBeNull();
  });

  it('should check if token exists', async () => {
    await manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');

    expect(await manager.hasToken(1, 'github')).toBe(true);
    expect(await manager.hasToken(1, 'gitlab')).toBe(false);
  });
});