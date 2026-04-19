// packages/e2e/helpers/test-db.ts
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initSchema } from '@code-link/server/dist/db/init.js';
import {
  users,
  organizations,
  organizationMembers,
  organizationInvitations,
  projects,
  drafts,
  draftMembers,
  draftMessages,
} from '@code-link/server/dist/db/schema/index.js';

// Schema 对象（从 server 导入）
const schema = {
  users,
  organizations,
  organizationMembers,
  organizationInvitations,
  projects,
  drafts,
  draftMembers,
  draftMessages,
};

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

export type DrizzleDb = ReturnType<typeof drizzle>;

/**
 * 创建内存测试数据库并初始化 schema
 */
export function createTestDb(): { sqlite: Database.Database; db: DrizzleDb } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // 使用 server 的 initSchema 初始化表结构
  initSchema(sqlite);

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/**
 * 创建测试用户
 */
export async function seedTestUser(
  db: DrizzleDb,
  overrides?: Partial<TestUser>
): Promise<TestUser> {
  const email = overrides?.email || 'test@example.com';
  const name = overrides?.name || 'Test User';
  const password = overrides?.password || 'testpassword';
  const passwordHash = bcrypt.hashSync(password, 10);

  const result = await db.insert(users).values({
    name,
    email,
    passwordHash,
  }).returning().get();

  return { id: result.id, email, name, password };
}

/**
 * 创建测试组织
 */
export async function seedTestOrganization(
  db: DrizzleDb,
  userId: number,
  name?: string
): Promise<number> {
  const orgName = name || 'Test Organization';

  const result = await db.insert(organizations).values({
    name: orgName,
    createdBy: userId,
  }).returning().get();

  const orgId = result.id;

  // 添加用户为组织成员
  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId,
    role: 'owner',
    invitedBy: userId,
  });

  return orgId;
}

/**
 * 创建测试项目
 */
export async function seedTestProject(
  db: DrizzleDb,
  userId: number,
  organizationId: number,
  overrides?: { name?: string; templateType?: 'node' | 'node+java' | 'node+python' }
): Promise<number> {
  const projectName = overrides?.name || 'Test Project';
  const templateType = overrides?.templateType || 'node';

  const result = await db.insert(projects).values({
    name: projectName,
    templateType,
    organizationId,
    createdBy: userId,
    status: 'created',
  }).returning().get();

  return result.id;
}

/**
 * 关闭数据库连接
 */
export function closeTestDb(sqlite: Database.Database): void {
  sqlite.close();
}

/**
 * 创建测试草稿
 */
export async function seedTestDraft(
  db: DrizzleDb,
  userId: number,
  projectId: number,
  overrides?: { title?: string; status?: 'discussing' | 'confirmed' | 'archived' }
): Promise<number> {
  const title = overrides?.title || 'Test Draft';
  const status = overrides?.status || 'discussing';

  const result = await db.insert(drafts).values({
    projectId,
    title,
    status,
    createdBy: userId,
  }).returning().get();

  const draftId = result.id;

  // 添加用户为草稿成员
  await db.insert(draftMembers).values({
    draftId,
    userId,
    role: 'owner',
  });

  return draftId;
}

/**
 * 创建测试消息
 */
export async function seedTestMessage(
  db: DrizzleDb,
  draftId: number,
  userId: number,
  overrides?: { content?: string; messageType?: 'text' | 'system'; parentId?: number }
): Promise<number> {
  const content = overrides?.content || 'Test message content';
  const messageType = overrides?.messageType || 'text';
  const parentId = overrides?.parentId ?? null;

  const result = await db.insert(draftMessages).values({
    draftId,
    userId,
    content,
    messageType,
    parentId,
  }).returning().get();

  return result.id;
}

/**
 * 创建测试邀请
 */
export async function seedTestInvitation(
  db: DrizzleDb,
  organizationId: number,
  invitedBy: number,
  overrides?: { email?: string; role?: 'owner' | 'developer' | 'member'; status?: 'pending' | 'accepted' | 'declined' }
): Promise<number> {
  const email = overrides?.email || 'invited@example.com';
  const role = overrides?.role || 'member';
  const status = overrides?.status || 'pending';

  const result = await db.insert(organizationInvitations).values({
    organizationId,
    email,
    role,
    invitedBy,
    status,
  }).returning().get();

  return result.id;
}