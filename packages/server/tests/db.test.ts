import { describe, it, expect } from 'vitest';
import { getSqliteDb, closeDb } from '../src/db/index.ts';
import { initSchema } from '../src/db/schema.ts';

describe('数据库 Schema', () => {
  it('应创建所有必要的表', () => {
    const db = getSqliteDb(':memory:');
    initSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('projects');
    expect(names).toContain('project_members');
    expect(names).toContain('builds');
    expect(names).toContain('project_tokens');
    expect(names).toContain('project_repos');
    expect(names).toContain('drafts');
    expect(names).toContain('draft_messages');
    expect(names).toContain('organizations');
    expect(names).toContain('organization_members');
    closeDb();
  });

  it('应能插入用户', () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('测试用户', 'test@test.com', 'hash123');
    expect(result.changes).toBe(1);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('test@test.com') as any;
    expect(user.name).toBe('测试用户');
    closeDb();
  });

  it('不允许重复邮箱', () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('用户1', 'dup@test.com', 'hash');
    expect(() => {
      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('用户2', 'dup@test.com', 'hash');
    }).toThrow();
    closeDb();
  });

  it('应能创建项目并关联成员', () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('创建者', 'owner@test.com', 'hash');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('owner@test.com') as any;

    // 创建组织
    db.prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)').run('测试组织', user.id);
    const org = db.prepare('SELECT id FROM organizations WHERE name = ?').get('测试组织') as any;

    db.prepare('INSERT INTO projects (name, template_type, status, created_by, organization_id) VALUES (?, ?, ?, ?, ?)').run('测试项目', 'node', 'created', user.id, org.id);
    const project = db.prepare('SELECT id FROM projects WHERE name = ?').get('测试项目') as any;

    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(project.id, user.id, 'owner');
    const member = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(project.id, user.id) as any;
    expect(member.role).toBe('owner');
    closeDb();
  });

  it('外键约束应阻止插入无效的用户引用', () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    // 创建组织但不创建用户
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('temp', 'temp@test.com', 'hash');
    db.prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)').run('temp-org', 1);
    expect(() => {
      db.prepare('INSERT INTO projects (name, template_type, status, created_by, organization_id) VALUES (?, ?, ?, ?, ?)').run('项目', 'node', 'created', 9999, 1);
    }).toThrow();
    closeDb();
  });

  it('CHECK 约束应拒绝无效的模板类型', () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('用户', 'check@test.com', 'hash');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('check@test.com') as any;
    db.prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)').run('测试组织', user.id);
    const org = db.prepare('SELECT id FROM organizations WHERE name = ?').get('测试组织') as any;
    expect(() => {
      db.prepare('INSERT INTO projects (name, template_type, status, created_by, organization_id) VALUES (?, ?, ?, ?, ?)').run('项目', 'invalid_type', 'created', user.id, org.id);
    }).toThrow();
    closeDb();
  });

  it('ON DELETE CASCADE 应删除相关项目成员', () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('用户', 'cascade@test.com', 'hash');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('cascade@test.com') as any;
    db.prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)').run('测试组织', user.id);
    const org = db.prepare('SELECT id FROM organizations WHERE name = ?').get('测试组织') as any;
    db.prepare('INSERT INTO projects (name, template_type, status, created_by, organization_id) VALUES (?, ?, ?, ?, ?)').run('项目', 'node', 'created', user.id, org.id);
    const project = db.prepare('SELECT id FROM projects WHERE name = ?').get('项目') as any;
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(project.id, user.id, 'owner');

    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    const members = db.prepare('SELECT * FROM project_members WHERE project_id = ?').all(project.id);
    expect(members).toHaveLength(0);
    closeDb();
  });
});