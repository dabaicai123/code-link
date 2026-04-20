import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/test-db.js';
import {
  createTestUser,
  createTestOrganization,
  createTestProject,
  findUserByEmail,
} from './helpers/test-db.js';
import { eq, and } from 'drizzle-orm';
import { users, projects, organizationMembers, organizations } from '../src/db/schema/index.js';
import { container } from 'tsyringe';
import { DatabaseConnection } from '../src/db/index.js';

function getTestDb() {
  return container.resolve(DatabaseConnection).getDb();
}

describe('数据库 Schema', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('应创建所有必要的表', () => {
    const sqlite = container.resolve(DatabaseConnection).getSqlite();
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('projects');
    expect(names).toContain('builds');
    expect(names).toContain('project_tokens');
    expect(names).toContain('project_repos');
    expect(names).toContain('drafts');
    expect(names).toContain('draft_messages');
    expect(names).toContain('organizations');
    expect(names).toContain('organization_members');
  });

  it('应能插入用户', () => {
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
  });

  it('不允许重复邮箱', () => {
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
  });

  it('应能创建项目并关联成员', () => {
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

    const db = getTestDb();
    // 创建组织成员（项目成员关系现在通过组织管理）
    db.insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: user.id,
        role: 'owner',
        invitedBy: user.id,
      })
      .run();

    const member = db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, user.id)
        )
      )
      .get();

    expect(member).toBeDefined();
    expect(member!.role).toBe('owner');
  });

  it('外键约束应阻止插入无效的用户引用', () => {
    const user = createTestUser({
      name: 'temp',
      email: 'temp@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: 'temp-org' });

    const db = getTestDb();
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
  });

  it('CHECK 约束应拒绝无效的模板类型', () => {
    const user = createTestUser({
      name: '用户',
      email: 'check@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: '测试组织' });

    const db = getTestDb();
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
  });

  it('ON DELETE CASCADE 应删除相关组织成员', () => {
    const user = createTestUser({
      name: '用户',
      email: 'cascade@test.com',
      passwordHash: 'hash',
    });

    const org = createTestOrganization(user.id, { name: '测试组织' });

    const db = getTestDb();
    // 创建组织成员
    db.insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: user.id,
        role: 'owner',
        invitedBy: user.id,
      })
      .run();

    // 删除组织应级联删除组织成员
    db.delete(organizations).where(eq(organizations.id, org.id)).run();

    // 验证组织成员也被删除
    const members = db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, org.id))
      .all();

    expect(members).toHaveLength(0);
  });
});