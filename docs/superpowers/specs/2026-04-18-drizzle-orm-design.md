# Drizzle ORM 数据库重构设计

## 背景

当前项目使用 `better-sqlite3` 直接执行原生 SQL，存在以下问题：

1. SQL 查询分散在各路由文件中，难以维护
2. 没有类型安全的实体模型，结果需要手动类型断言
3. 关系查询需要手动编写 JOIN 语句
4. 没有统一的 Repository/Service 层抽象

后续需要支持 PostgreSQL，选择 Drizzle ORM 作为解决方案。

## 技术选型

**Drizzle ORM**

- 专为 TypeScript 设计，类型安全优秀
- 支持 SQLite 和 PostgreSQL，切换成本低
- SQL-like 语法，学习成本低
- Schema 即代码，迁移可自动生成
- 轻量，无额外运行时依赖

## 项目结构

```
packages/server/src/
├── db/
│   ├── index.ts          # Drizzle 客户端初始化
│   ├── schema/           # Schema 定义目录
│   │   ├── users.ts
│   │   ├── organizations.ts
│   │   ├── projects.ts
│   │   ├── drafts.ts
│   │   ├── builds.ts
│   │   ├── tokens.ts
│   │   ├── repos.ts
│   │   └── index.ts      # 导出所有 schema
│   └── migrations/       # Drizzle 生成的迁移文件
├── repositories/         # Repository 层 - 数据访问
│   ├── user.repository.ts
│   ├── organization.repository.ts
│   ├── project.repository.ts
│   ├── draft.repository.ts
│   ├── build.repository.ts
│   └── index.ts
├── services/             # Service 层 - 业务逻辑
│   ├── auth.service.ts
│   ├── organization.service.ts
│   ├── project.service.ts
│   ├── draft.service.ts
│   ├── build.service.ts
│   └── index.ts
├── routes/               # 路由层 - HTTP 处理（简化后）
│   ├── auth.ts
│   ├── organizations.ts
│   ├── projects.ts
│   ├── drafts.ts
│   ├── builds.ts
│   └── ...
```

## Schema 定义

### users.ts

```typescript
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
```

### organizations.ts

```typescript
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
```

### projects.ts

```typescript
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
```

### drafts.ts

```typescript
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
  parentId: integer('parent_id').references((): any => draftMessages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content'),
  messageType: text('message_type', {
    enum: ['text', 'image', 'code', 'document_card', 'ai_command', 'system']
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
```

### builds.ts

```typescript
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
```

### tokens.ts

```typescript
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
```

### repos.ts

```typescript
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
```

### 其他表

```typescript
// messages.ts
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  type: text('type', { enum: ['chat', 'notification'] }).notNull().default('chat'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

// user-claude-configs.ts
export const userClaudeConfigs = sqliteTable('user_claude_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }).unique(),
  config: text('config').notNull(),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});
```

## 数据库初始化

```typescript
// packages/server/src/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

const dbPath = process.env.DB_PATH || path.join(DATA_DIR, 'code-link.db');
const sqliteDb = new Database(dbPath);
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

export const db = drizzle(sqliteDb, { schema });

export { sqliteDb };
```

## Repository 层

### user.repository.ts

```typescript
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import type { InsertUser, SelectUser } from '../db/schema/index.js';

export class UserRepository {
  async findByEmail(email: string): Promise<SelectUser | undefined> {
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  async findById(id: number): Promise<SelectUser | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async create(data: InsertUser): Promise<SelectUser> {
    return db.insert(users).values(data).returning().get();
  }

  async updateAvatar(id: number, avatar: string): Promise<SelectUser> {
    return db.update(users).set({ avatar }).where(eq(users.id, id)).returning().get();
  }
}
```

### organization.repository.ts

```typescript
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizations, organizationMembers, users } from '../db/schema/index.js';

export class OrganizationRepository {
  async findById(id: number) {
    return db.select().from(organizations).where(eq(organizations.id, id)).get();
  }

  async create(data: { name: string; createdBy: number }) {
    return db.insert(organizations).values(data).returning().get();
  }

  async findUserMembership(orgId: number, userId: number) {
    return db.select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .get();
  }

  async findUserOrganizations(userId: number) {
    return db.select({ organization: organizations })
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId));
  }

  async addMember(data: { organizationId: number; userId: number; role: string; invitedBy: number }) {
    return db.insert(organizationMembers).values(data).returning().get();
  }
}
```

### project.repository.ts

```typescript
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, projectRepos, organizationMembers, users } from '../db/schema/index.js';

export class ProjectRepository {
  async findById(id: number) {
    return db.select().from(projects).where(eq(projects.id, id)).get();
  }

  async create(data: { name: string; templateType: string; organizationId: number; createdBy: number }) {
    return db.insert(projects).values(data).returning().get();
  }

  async findByOrganizationId(orgId: number) {
    return db.select().from(projects).where(eq(projects.organizationId, orgId));
  }

  async findByUserId(userId: number) {
    return db.select({ project: projects })
      .from(projects)
      .innerJoin(
        organizationMembers,
        eq(projects.organizationId, organizationMembers.organizationId)
      )
      .where(eq(organizationMembers.userId, userId));
  }

  async findRepos(projectId: number) {
    return db.select().from(projectRepos).where(eq(projectRepos.projectId, projectId));
  }

  async delete(id: number) {
    return db.delete(projects).where(eq(projects.id, id)).run();
  }
}
```

## Service 层

### auth.service.ts

```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';
import { JWT_SECRET } from '../middleware/auth.js';

export class AuthService {
  private userRepo = new UserRepository();

  async register(data: { name: string; email: string; password: string }) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('该邮箱已被注册');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: this.sanitizeUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new Error('邮箱或密码错误');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: this.sanitizeUser(user) };
  }

  async getUser(userId: number) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('用户不存在');
    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
```

### project.service.ts

```typescript
import { ProjectRepository } from '../repositories/project.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';

export class ProjectService {
  private projectRepo = new ProjectRepository();
  private orgRepo = new OrganizationRepository();

  async create(userId: number, data: { name: string; templateType: string; organizationId: number }) {
    // 验证权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(data.organizationId, userId);
      if (!membership || !['owner', 'developer'].includes(membership.role)) {
        throw new Error('您没有权限在该组织下创建项目');
      }
    }

    const project = await this.projectRepo.create({
      name: data.name,
      templateType: data.templateType,
      organizationId: data.organizationId,
      createdBy: userId,
    });

    return project;
  }

  async findByUserId(userId: number) {
    return this.projectRepo.findByUserId(userId);
  }

  async findById(userId: number, projectId: number) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw new Error('项目不存在');

    // 验证访问权限
    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership && !isSuperAdmin(userId)) {
      throw new Error('您没有权限访问该项目');
    }

    const repos = await this.projectRepo.findRepos(projectId);
    return { ...project, repos };
  }

  async delete(userId: number, projectId: number) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw new Error('项目不存在');

    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new Error('只有组织 owner 可以删除项目');
    }

    await this.projectRepo.delete(projectId);
  }
}
```

## 路由简化

```typescript
// packages/server/src/routes/auth.ts
import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await authService.getUser(userId);
      res.json(user);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  return router;
}
```

## Drizzle 配置

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

## 依赖安装

```json
{
  "dependencies": {
    "drizzle-orm": "^0.x"
  },
  "devDependencies": {
    "drizzle-kit": "^0.x"
  }
}
```

## 迁移步骤

1. 安装 Drizzle ORM 和 drizzle-kit
2. 创建 schema 定义文件
3. 创建数据库初始化模块
4. 创建 Repository 层
5. 创建 Service 层
6. 重构路由文件
7. 删除旧的 schema.ts 和 migration.ts
8. 更新测试

## PostgreSQL 迁移

后续切换到 PostgreSQL 时：

1. 安装 `postgres` 或 `pg` 驱动
2. 修改 `drizzle.config.ts` 的 `dialect` 为 `postgresql`
3. Schema 中 `sqliteTable` 改为 `pgTable`
4. 调整部分类型差异（如 `integer → serial`，`text → varchar`）
5. 重新生成迁移文件
