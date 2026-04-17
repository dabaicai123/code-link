import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.js';

describe('Project Tokens Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should have project_tokens table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    expect(tables.some(t => t.name === 'project_tokens')).toBe(true);
  });

  it('should have project_repos table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    expect(tables.some(t => t.name === 'project_repos')).toBe(true);
  });

  it('should insert and retrieve token', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');

    db.prepare('INSERT INTO project_tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z'
    );

    const token = db.prepare('SELECT * FROM project_tokens WHERE user_id = ? AND provider = ?').get(1, 'github') as any;
    expect(token.access_token).toBe('gh_token');
    expect(token.provider).toBe('github');
  });

  it('should enforce unique constraint on user_id and provider', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');

    db.prepare('INSERT INTO project_tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z'
    );

    // Should fail due to unique constraint
    expect(() => {
      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        1, 'github', 'gh_token2', 'gh_refresh2', '2025-02-01T00:00:00Z'
      );
    }).toThrow();
  });

  it('should cascade delete tokens when user is deleted', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    db.prepare('INSERT INTO project_tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z'
    );

    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(1);

    // Token should be deleted
    const token = db.prepare('SELECT * FROM project_tokens WHERE user_id = ?').get(1);
    expect(token).toBeUndefined();
  });

  it('should insert and retrieve project_repo', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);

    db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'https://github.com/user/repo', 'user/repo', 'main'
    );

    const repo = db.prepare('SELECT * FROM project_repos WHERE project_id = ?').get(1) as any;
    expect(repo.repo_url).toBe('https://github.com/user/repo');
    expect(repo.repo_name).toBe('user/repo');
    expect(repo.provider).toBe('github');
    expect(repo.branch).toBe('main');
  });

  it('should enforce unique constraint on project_id and repo_url', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);

    db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'https://github.com/user/repo', 'user/repo', 'main'
    );

    // Should fail due to unique constraint
    expect(() => {
      db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
        1, 'gitlab', 'https://github.com/user/repo', 'user/repo', 'develop'
      );
    }).toThrow();
  });

  it('should cascade delete project_repos when project is deleted', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);
    db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'https://github.com/user/repo', 'user/repo', 'main'
    );

    // Delete project
    db.prepare('DELETE FROM projects WHERE id = ?').run(1);

    // project_repo should be deleted
    const repo = db.prepare('SELECT * FROM project_repos WHERE project_id = ?').get(1);
    expect(repo).toBeUndefined();
  });

  it('should only accept valid provider values for project_tokens', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');

    // Invalid provider should fail
    expect(() => {
      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        1, 'invalid_provider', 'token', 'refresh', '2025-01-01T00:00:00Z'
      );
    }).toThrow();
  });

  it('should only accept valid provider values for project_repos', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);

    // Invalid provider should fail
    expect(() => {
      db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
        1, 'invalid_provider', 'https://example.com/repo', 'repo', 'main'
      );
    }).toThrow();
  });
});