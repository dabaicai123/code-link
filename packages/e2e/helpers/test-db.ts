// packages/e2e/helpers/test-db.ts
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 定义 schema（与 server 包保持一致）
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatar: text('avatar'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const organizationMembers = sqliteTable('organization_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'member'] }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  joinedAt: text('joined_at').notNull().default("datetime('now')"),
}, (table) => ({
  orgUserUnique: index().on(table.organizationId, table.userId),
}));

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  templateType: text('template_type', { enum: ['node', 'node+java', 'node+python'] }).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id),
  containerId: text('container_id'),
  status: text('status', { enum: ['created', 'running', 'stopped'] }).notNull().default('created'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'product'] }).notNull(),
}, (table) => ({
  projectUserUnique: index().on(table.projectId, table.userId),
}));

// Schema 对象
const schema = { users, organizations, organizationMembers, projects, projectMembers };

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

/**
 * 创建内存测试数据库并初始化 schema
 */
export function createTestDb(): { sqlite: Database.Database; db: ReturnType<typeof drizzle> } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // 使用 server 的 initSchema 初始化表结构
  initSchema(sqlite);

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/**
 * 初始化数据库 schema（从 server 复制，避免导入问题）
 */
function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS organization_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, email)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_type TEXT NOT NULL CHECK (template_type IN ('node', 'node+java', 'node+python')),
      organization_id INTEGER REFERENCES organizations(id),
      container_id TEXT,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'stopped')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'product')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
      preview_port INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS project_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      repo_url TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      cloned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, repo_url)
    );

    CREATE TABLE IF NOT EXISTS user_claude_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id)
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'discussing' CHECK (status IN ('discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draft_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'participant')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(draft_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS draft_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES draft_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT,
      message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'code', 'document_card', 'ai_command', 'system', 'ai_response', 'ai_error')),
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES draft_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'agree' CHECK (type IN ('agree', 'disagree', 'suggest')),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
    CREATE INDEX IF NOT EXISTS idx_drafts_project_id ON drafts(project_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
    CREATE INDEX IF NOT EXISTS idx_draft_members_draft_id ON draft_members(draft_id);
    CREATE INDEX IF NOT EXISTS idx_draft_messages_draft_id ON draft_messages(draft_id);
  `);
}

/**
 * 创建测试用户
 */
export async function seedTestUser(
  db: ReturnType<typeof drizzle>,
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
  db: ReturnType<typeof drizzle>,
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
  db: ReturnType<typeof drizzle>,
  userId: number,
  organizationId?: number,
  overrides?: { name?: string; templateType?: 'node' | 'node+java' | 'node+python' }
): Promise<number> {
  const projectName = overrides?.name || 'Test Project';
  const templateType = overrides?.templateType || 'node';

  const result = await db.insert(projects).values({
    name: projectName,
    templateType,
    organizationId: organizationId ?? null,
    createdBy: userId,
    status: 'created',
  }).returning().get();

  const projectId = result.id;

  // 添加用户为项目成员
  await db.insert(projectMembers).values({
    projectId,
    userId,
    role: 'owner',
  });

  return projectId;
}

/**
 * 关闭数据库连接
 */
export function closeTestDb(sqlite: Database.Database): void {
  sqlite.close();
}