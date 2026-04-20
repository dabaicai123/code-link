import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/init.js';

describe('Database indexes', () => {
  it('should have index on builds.project_id', () => {
    const db = new Database(':memory:');
    initSchema(db);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='builds'").all() as { name: string }[];
    const indexNames = indexes.map(r => r.name);
    expect(indexNames).toContain('idx_builds_project_id');

    db.close();
  });

  it('should have index on projects.organization_id', () => {
    const db = new Database(':memory:');
    initSchema(db);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='projects'").all() as { name: string }[];
    const indexNames = indexes.map(r => r.name);
    expect(indexNames).toContain('idx_projects_organization_id');

    db.close();
  });

  it('should have index on project_tokens.user_id', () => {
    const db = new Database(':memory:');
    initSchema(db);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='project_tokens'").all() as { name: string }[];
    const indexNames = indexes.map(r => r.name);
    expect(indexNames).toContain('idx_tokens_user_id');

    db.close();
  });

  it('should have index on project_repos.project_id', () => {
    const db = new Database(':memory:');
    initSchema(db);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='project_repos'").all() as { name: string }[];
    const indexNames = indexes.map(r => r.name);
    expect(indexNames).toContain('idx_repos_project_id');

    db.close();
  });
});
