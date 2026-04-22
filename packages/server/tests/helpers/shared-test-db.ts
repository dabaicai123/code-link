// packages/server/tests/helpers/shared-test-db.ts
/**
 * 共享测试数据库基础设施
 * 可被 server 测试和 e2e 测试共同使用
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { runMigrations } from '../../src/db/migrate-runner.js';
import {
  users,
  organizations,
  organizationMembers,
  organizationInvitations,
  projects,
  drafts,
  draftMembers,
  draftMessages,
} from '../../src/db/schema/index.js';

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

export type DrizzleDb = ReturnType<typeof drizzle>;

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

/**
 * 创建内存测试数据库并初始化 schema
 */
export function createMemoryTestDb(): { sqlite: Database.Database; db: DrizzleDb } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  runMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/**
 * 关闭数据库连接
 */
export function closeTestDb(sqlite: Database.Database): void {
  sqlite.close();
}

// ============================================================================
// Seed Helpers - 创建测试数据
// ============================================================================

export interface SeedUserOptions {
  email?: string;
  name?: string;
  password?: string;
}

export async function seedTestUser(db: DrizzleDb, options: SeedUserOptions = {}): Promise<TestUser> {
  const email = options.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const name = options.name || 'Test User';
  const password = options.password || 'testpassword';
  const passwordHash = bcrypt.hashSync(password, 10);

  const result = await db.insert(users).values({
    name,
    email,
    passwordHash,
  }).returning().get();

  return { id: result.id, email, name, password };
}

export interface SeedOrganizationOptions {
  name?: string;
  role?: 'owner' | 'developer' | 'member';
}

export async function seedTestOrganization(
  db: DrizzleDb,
  userId: number,
  options: SeedOrganizationOptions = {}
): Promise<number> {
  const orgName = options.name || 'Test Organization';
  const role = options.role || 'owner';

  const result = await db.insert(organizations).values({
    name: orgName,
    createdBy: userId,
  }).returning().get();

  const orgId = result.id;

  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId,
    role,
    invitedBy: userId,
  });

  return orgId;
}

export interface SeedProjectOptions {
  name?: string;
  templateType?: 'node' | 'node+java' | 'node+python';
  status?: 'created' | 'running' | 'stopped';
}

export async function seedTestProject(
  db: DrizzleDb,
  userId: number,
  organizationId: number,
  options: SeedProjectOptions = {}
): Promise<number> {
  const projectName = options.name || 'Test Project';
  const templateType = options.templateType || 'node';
  const status = options.status || 'created';

  const result = await db.insert(projects).values({
    name: projectName,
    templateType,
    organizationId,
    createdBy: userId,
    status,
  }).returning().get();

  return result.id;
}

export interface SeedDraftOptions {
  title?: string;
  status?: 'discussing' | 'confirmed' | 'archived';
}

export async function seedTestDraft(
  db: DrizzleDb,
  userId: number,
  projectId: number,
  options: SeedDraftOptions = {}
): Promise<number> {
  const title = options.title || 'Test Draft';
  const status = options.status || 'discussing';

  const result = await db.insert(drafts).values({
    projectId,
    title,
    status,
    createdBy: userId,
  }).returning().get();

  const draftId = result.id;

  await db.insert(draftMembers).values({
    draftId,
    userId,
    role: 'owner',
  });

  return draftId;
}

export interface SeedMessageOptions {
  content?: string;
  messageType?: 'text' | 'system';
  parentId?: number;
}

export async function seedTestMessage(
  db: DrizzleDb,
  draftId: number,
  userId: number,
  options: SeedMessageOptions = {}
): Promise<number> {
  const content = options.content || 'Test message content';
  const messageType = options.messageType || 'text';
  const parentId = options.parentId ?? null;

  const result = await db.insert(draftMessages).values({
    draftId,
    userId,
    content,
    messageType,
    parentId,
  }).returning().get();

  return result.id;
}

export interface SeedInvitationOptions {
  email?: string;
  role?: 'owner' | 'developer' | 'member';
  status?: 'pending' | 'accepted' | 'declined';
}

export async function seedTestInvitation(
  db: DrizzleDb,
  organizationId: number,
  invitedBy: number,
  options: SeedInvitationOptions = {}
): Promise<number> {
  const email = options.email || `invited-${Date.now()}@test.com`;
  const role = options.role || 'member';
  const status = options.status || 'pending';

  const result = await db.insert(organizationInvitations).values({
    organizationId,
    email,
    role,
    invitedBy,
    status,
  }).returning().get();

  return result.id;
}

// ============================================================================
// Query Helpers - 查询测试数据
// ============================================================================

export async function findUserById(db: DrizzleDb, id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function findUserByEmail(db: DrizzleDb, email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export async function findOrganizationById(db: DrizzleDb, id: number) {
  return db.select().from(organizations).where(eq(organizations.id, id)).get();
}

export async function findProjectById(db: DrizzleDb, id: number) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export async function findDraftById(db: DrizzleDb, id: number) {
  return db.select().from(drafts).where(eq(drafts.id, id)).get();
}
