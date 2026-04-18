import { describe, it, expect } from 'vitest';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import {
  createTestUser,
  createTestOrganization,
  createTestProject,
  deleteTestProject,
  deleteTestUser,
  findUserByEmail,
} from './helpers/test-db.js';
import { eq } from 'drizzle-orm';
import { users, projects, projectMembers, organizations } from '../src/db/schema/index.js';

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
    getDb(':memory:');
    initSchema(getSqliteDb());

    const user = createTestUser({
      name: '测试用户',
      email: 'test@test.com',
      passwordHash: 'hash123',
    });

    expect(user.name).toBe('测试用户');
    expect(user.email).toBe('test@test.com');

    const foundUser = findUserByEmail('test@test.com');
    expect(foundUser).toBeDefined();
    expect(foundUser!.name).toBe('测试用户');
    closeDb();
  });

  it('不允许重复邮箱', () => {
    closeDb();
    getDb(':memory:');
    initSchema(getSqliteDb());

    createTestUser({
      name: '用户1',
      email: 'dup@test.com',
      passwordHash: 'hash',
    });

    expect(() => {
      createTestUser({
        name: '用户2',
        email: 'dup@test.com',
        passwordHash: 'hash',
      });
    }).toThrow();

    closeDb();
  });

  it('应能创建项目并关联成员', () => {
    closeDb();
    getDb(':memory:');
    initSchema(getSqliteDb());

    const user = createTestUser({
      name: '创建者',
      email: 'owner@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: '测试组织' });

    const project = createTestProject(user.id, org.id, {
      name: '测试项目',
      templateType: 'node',
      status: 'created',
    });

    const db = getDb();
    // 创建项目成员
    db.insert(projectMembers)
      .values({
        projectId: project.id,
        userId: user.id,
        role: 'owner',
      })
      .run();

    const member = db
      .select()
      .from(projectMembers)
      .where(
        eq(projectMembers.projectId, project.id) &&
        eq(projectMembers.userId, user.id)
      )
      .get();

    expect(member).toBeDefined();
    expect(member!.role).toBe('owner');
    closeDb();
  });

  it('外键约束应阻止插入无效的用户引用', () => {
    closeDb();
    getDb(':memory:');
    initSchema(getSqliteDb());

    const user = createTestUser({
      name: 'temp',
      email: 'temp@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: 'temp-org' });

    const db = getDb();
    expect(() => {
      db.insert(projects)
        .values({
          name: '项目',
          templateType: 'node',
          status: 'created',
          createdBy: 9999, // 不存在的用户ID
          organizationId: org.id,
        })
        .run();
    }).toThrow();

    closeDb();
  });

  it('CHECK 约束应拒绝无效的模板类型', () => {
    closeDb();
    getDb(':memory:');
    initSchema(getSqliteDb());

    const user = createTestUser({
      name: '用户',
      email: 'check@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: '测试组织' });

    const db = getDb();
    expect(() => {
      db.insert(projects)
        .values({
          name: '项目',
          templateType: 'invalid_type' as any, // 无效的模板类型
          status: 'created',
          createdBy: user.id,
          organizationId: org.id,
        })
        .run();
    }).toThrow();

    closeDb();
  });

  it('ON DELETE CASCADE 应删除相关项目成员', () => {
    closeDb();
    getDb(':memory:');
    initSchema(getSqliteDb());

    const user = createTestUser({
      name: '用户',
      email: 'cascade@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: '测试组织' });

    const project = createTestProject(user.id, org.id, {
      name: '项目',
      templateType: 'node',
      status: 'created',
    });

    const db = getDb();
    // 创建项目成员
    db.insert(projectMembers)
      .values({
        projectId: project.id,
        userId: user.id,
        role: 'owner',
      })
      .run();

    // 删除项目
    deleteTestProject(project.id);

    // 验证项目成员也被删除
    const members = db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, project.id))
      .all();

    expect(members).toHaveLength(0);
    closeDb();
  });
});
