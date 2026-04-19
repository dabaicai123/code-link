# Drizzle ORM 数据库重构 - Phase 1: 基础设施

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Drizzle ORM 基础设施，包括 Schema 定义、数据库初始化和配置文件。

**Architecture:** 使用 Drizzle ORM 替代原生 SQL，保持 SQLite 后端兼容，Schema 即代码，类型安全的数据库访问。

**Tech Stack:** Drizzle ORM, better-sqlite3, drizzle-kit, TypeScript

---

## 前置条件

- 现有项目使用 `better-sqlite3` 直接执行 SQL
- 数据库 Schema 定义在 `packages/server/src/db/schema.ts`
- 数据库连接在 `packages/server/src/db/connection.ts`
- 迁移脚本在 `packages/server/src/db/migration.ts`

---

### Task 1: 安装 Drizzle ORM 依赖

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: 安装 Drizzle ORM 和 drizzle-kit**

```bash
cd packages/server && npm install drizzle-orm && npm install -D drizzle-kit
```

Expected: 依赖安装成功，package.json 更新

- [ ] **Step 2: 验证安装**

```bash
cd packages/server && npm ls drizzle-orm drizzle-kit
```

Expected: 显示安装的版本号

---

### Task 2: 创建 Drizzle Schema 目录结构

**Files:**
- Create: `packages/server/src/db/schema/users.ts`
- Create: `packages/server/src/db/schema/organizations.ts`
- Create: `packages/server/src/db/schema/projects.ts`
- Create: `packages/server/src/db/schema/drafts.ts`
- Create: `packages/server/src/db/schema/builds.ts`
- Create: `packages/server/src/db/schema/tokens.ts`
- Create: `packages/server/src/db/schema/repos.ts`
- Create: `packages/server/src/db/schema/messages.ts`
- Create: `packages/server/src/db/schema/claude-configs.ts`
- Create: `packages/server/src/db/schema/index.ts`

- [ ] **Step 1: 创建 users schema**

```typescript
// packages/server/src/db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatar: text('avatar'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
```

- [ ] **Step 2: 创建 organizations schema**

```typescript
// packages/server/src/db/schema/organizations.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export const organizationMembers = sqliteTable('organization_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'member'] }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  joinedAt: text('joined_at').notNull().default(sql`datetime('now')`),
});

export const organizationInvitations = sqliteTable('organization_invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['owner', 'developer', 'member'] }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'accepted', 'declined'] })
    .notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertOrganization = typeof organizations.$inferInsert;
export type SelectOrganization = typeof organizations.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type SelectOrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationInvitation = typeof organizationInvitations.$inferInsert;
export type SelectOrganizationInvitation = typeof organizationInvitations.$inferSelect;
```

- [ ] **Step 3: 创建 projects schema**

```typescript
// packages/server/src/db/schema/projects.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { organizations } from './organizations';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  templateType: text('template_type', { enum: ['node', 'node+java', 'node+python'] }).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id),
  containerId: text('container_id'),
  status: text('status', { enum: ['created', 'running', 'stopped'] }).notNull().default('created'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'product'] }).notNull(),
});

export type InsertProject = typeof projects.$inferInsert;
export type SelectProject = typeof projects.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;
export type SelectProjectMember = typeof projectMembers.$inferSelect;
```

- [ ] **Step 4: 创建 drafts schema**

```typescript
// packages/server/src/db/schema/drafts.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status', {
    enum: ['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived']
  }).notNull().default('discussing'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});

export const draftMembers = sqliteTable('draft_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'participant'] }).notNull().default('participant'),
  joinedAt: text('joined_at').notNull().default(sql`datetime('now')`),
});

export const draftMessages = sqliteTable('draft_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id'),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content'),
  messageType: text('message_type', {
    enum: ['text', 'image', 'code', 'document_card', 'ai_command', 'system', 'ai_response', 'ai_error']
  }).notNull().default('text'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});

export const messageConfirmations = sqliteTable('message_confirmations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: integer('message_id').notNull()
    .references(() => draftMessages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['agree', 'disagree', 'suggest'] }).notNull().default('agree'),
  comment: text('comment'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertDraft = typeof drafts.$inferInsert;
export type SelectDraft = typeof drafts.$inferSelect;
export type InsertDraftMember = typeof draftMembers.$inferInsert;
export type SelectDraftMember = typeof draftMembers.$inferSelect;
export type InsertDraftMessage = typeof draftMessages.$inferInsert;
export type SelectDraftMessage = typeof draftMessages.$inferSelect;
export type InsertMessageConfirmation = typeof messageConfirmations.$inferInsert;
export type SelectMessageConfirmation = typeof messageConfirmations.$inferSelect;
```

- [ ] **Step 5: 创建 builds schema**

```typescript
// packages/server/src/db/schema/builds.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';

export const builds = sqliteTable('builds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'running', 'success', 'failed'] })
    .notNull().default('pending'),
  previewPort: integer('preview_port'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertBuild = typeof builds.$inferInsert;
export type SelectBuild = typeof builds.$inferSelect;
```

- [ ] **Step 6: 创建 tokens schema**

```typescript
// packages/server/src/db/schema/tokens.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const projectTokens = sqliteTable('project_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'gitlab'] }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertProjectToken = typeof projectTokens.$inferInsert;
export type SelectProjectToken = typeof projectTokens.$inferSelect;
```

- [ ] **Step 7: 创建 repos schema**

```typescript
// packages/server/src/db/schema/repos.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';

export const projectRepos = sqliteTable('project_repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'gitlab'] }).notNull(),
  repoUrl: text('repo_url').notNull(),
  repoName: text('repo_name').notNull(),
  branch: text('branch').notNull().default('main'),
  cloned: integer('cloned', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertProjectRepo = typeof projectRepos.$inferInsert;
export type SelectProjectRepo = typeof projectRepos.$inferSelect;
```

- [ ] **Step 8: 创建 messages schema**

```typescript
// packages/server/src/db/schema/messages.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  type: text('type', { enum: ['chat', 'notification'] }).notNull().default('chat'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
```

- [ ] **Step 9: 创建 claude-configs schema**

```typescript
// packages/server/src/db/schema/claude-configs.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userClaudeConfigs = sqliteTable('user_claude_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }).unique(),
  config: text('config').notNull(),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});

export type InsertUserClaudeConfig = typeof userClaudeConfigs.$inferInsert;
export type SelectUserClaudeConfig = typeof userClaudeConfigs.$inferSelect;
```

- [ ] **Step 10: 创建 schema index 导出**

```typescript
// packages/server/src/db/schema/index.ts
// Users
export { users } from './users.js';
export type { InsertUser, SelectUser } from './users.js';

// Organizations
export {
  organizations,
  organizationMembers,
  organizationInvitations,
} from './organizations.js';
export type {
  InsertOrganization,
  SelectOrganization,
  InsertOrganizationMember,
  SelectOrganizationMember,
  InsertOrganizationInvitation,
  SelectOrganizationInvitation,
} from './organizations.js';

// Projects
export { projects, projectMembers } from './projects.js';
export type {
  InsertProject,
  SelectProject,
  InsertProjectMember,
  SelectProjectMember,
} from './projects.js';

// Drafts
export {
  drafts,
  draftMembers,
  draftMessages,
  messageConfirmations,
} from './drafts.js';
export type {
  InsertDraft,
  SelectDraft,
  InsertDraftMember,
  SelectDraftMember,
  InsertDraftMessage,
  SelectDraftMessage,
  InsertMessageConfirmation,
  SelectMessageConfirmation,
} from './drafts.js';

// Builds
export { builds } from './builds.js';
export type { InsertBuild, SelectBuild } from './builds.js';

// Tokens
export { projectTokens } from './tokens.js';
export type { InsertProjectToken, SelectProjectToken } from './tokens.js';

// Repos
export { projectRepos } from './repos.js';
export type { InsertProjectRepo, SelectProjectRepo } from './repos.js';

// Messages
export { messages } from './messages.js';
export type { InsertMessage, SelectMessage } from './messages.js';

// Claude Configs
export { userClaudeConfigs } from './claude-configs.js';
export type { InsertUserClaudeConfig, SelectUserClaudeConfig } from './claude-configs.js';
```

---

### Task 3: 创建 Drizzle 数据库初始化模块

**Files:**
- Create: `packages/server/src/db/drizzle.ts`

- [ ] **Step 1: 创建 Drizzle 数据库初始化文件**

```typescript
// packages/server/src/db/drizzle.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

let defaultSqliteDb: Database.Database | null = null;
let defaultDb: ReturnType<typeof drizzle> | null = null;

/**
 * 获取 SQLite 数据库连接
 */
export function getSqliteDb(dbPath?: string): Database.Database {
  if (dbPath) {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
  }
  if (!defaultSqliteDb) {
    const dbPath = process.env.DB_PATH || path.join(DATA_DIR, 'code-link.db');
    defaultSqliteDb = new Database(dbPath);
    defaultSqliteDb.pragma('journal_mode = WAL');
    defaultSqliteDb.pragma('foreign_keys = ON');
  }
  return defaultSqliteDb;
}

/**
 * 获取 Drizzle 数据库实例
 */
export function getDb(dbPath?: string): ReturnType<typeof drizzle> {
  if (dbPath) {
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    return drizzle(sqliteDb, { schema });
  }
  if (!defaultDb) {
    const sqliteDb = getSqliteDb(dbPath);
    defaultDb = drizzle(sqliteDb, { schema });
  }
  return defaultDb;
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (defaultSqliteDb) {
    defaultSqliteDb.close();
    defaultSqliteDb = null;
    defaultDb = null;
  }
}

// 导出 SQLite 原生实例（用于需要原生 SQL 的场景，如迁移）
export { getSqliteDb as getNativeDb };
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 4: 创建 Drizzle 配置文件

**Files:**
- Create: `drizzle.config.ts` (项目根目录)

- [ ] **Step 1: 创建 Drizzle Kit 配置文件**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/server/src/db/schema/index.ts',
  out: './packages/server/src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/code-link.db',
  },
});
```

---

### Task 5: 创建 Schema 初始化函数

**Files:**
- Create: `packages/server/src/db/init.ts`

- [ ] **Step 1: 创建 Schema 初始化函数**

```typescript
// packages/server/src/db/init.ts
import type Database from 'better-sqlite3';
import { createLogger } from '../logger/index.js';

const logger = createLogger('db-init');

/**
 * 初始化数据库 Schema
 * 使用原生 SQL 创建表结构（与现有 schema.ts 保持一致）
 * 后续可以用 Drizzle 迁移替代
 */
export function initSchema(db: Database.Database): void {
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

    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

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

    CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);

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

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'chat' CHECK (type IN ('chat', 'notification')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    CREATE INDEX IF NOT EXISTS idx_drafts_project_id ON drafts(project_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
    CREATE INDEX IF NOT EXISTS idx_draft_members_draft_id ON draft_members(draft_id);
    CREATE INDEX IF NOT EXISTS idx_draft_members_user_id ON draft_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_draft_messages_draft_id ON draft_messages(draft_id);
    CREATE INDEX IF NOT EXISTS idx_draft_messages_parent_id ON draft_messages(parent_id);
    CREATE INDEX IF NOT EXISTS idx_message_confirmations_message_id ON message_confirmations(message_id);
  `);

  logger.info('Database schema initialized');
}
```

---

### Task 6: 更新数据库模块导出

**Files:**
- Create: `packages/server/src/db/index.ts`

- [ ] **Step 1: 创建数据库模块统一导出**

```typescript
// packages/server/src/db/index.ts
// Drizzle ORM 客户端
export { getDb, getSqliteDb, getNativeDb, closeDb } from './drizzle.js';

// Schema 定义
export * from './schema/index.js';

// 初始化
export { initSchema } from './init.js';

// 迁移函数（保持兼容）
export {
  runOrganizationMigration,
  runProjectOrganizationMigration,
  runRepoClonedMigration,
} from './migration.js';
```

---

### Task 7: 更新 package.json 脚本

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: 添加 Drizzle 相关脚本**

在 `packages/server/package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

### Task 8: 验证基础设施

**Files:**
- Modify: 无需修改文件

- [ ] **Step 1: 验证 TypeScript 编译**

```bash
cd packages/server && npm run build
```

Expected: 编译成功，无错误

- [ ] **Step 2: 验证 Drizzle Schema 生成**

```bash
cd /root/my/code-link && npx drizzle-kit push --dry-run
```

Expected: 显示将要执行的 SQL（但不执行）

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/db/ packages/server/package.json drizzle.config.ts
git commit -m "$(cat <<'EOF'
feat(server): add Drizzle ORM infrastructure

- Install drizzle-orm and drizzle-kit
- Create schema definitions for all tables
- Create Drizzle database initialization module
- Add drizzle.config.ts for migrations
- Add npm scripts for database management

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成标准

1. Drizzle ORM 和 drizzle-kit 已安装
2. 所有表的 Schema 定义已创建
3. Drizzle 数据库初始化模块已创建
4. 配置文件已创建
5. TypeScript 编译无错误
6. 提交已创建

## 后续阶段

完成此阶段后，进入 Phase 2: User/Authentication 模块重构。
