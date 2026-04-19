# E2E 认证模块测试计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善认证流程的端到端测试，覆盖注册、登录、登出、OAuth 和权限保护等所有场景。

**Architecture:** 使用 Playwright 测试框架，每个测试独立启动测试服务器和数据库实例，不依赖认证状态复用。数据库操作使用 Drizzle ORM。

**Tech Stack:** Playwright, better-sqlite3, drizzle-orm, express, bcryptjs, jsonwebtoken

---

## 当前状态分析

已有测试：
- ✅ 注册成功（mock API）
- ✅ 注册失败 - 邮箱已存在
- ✅ 登录成功
- ✅ 登录失败 - 错误密码
- ✅ 登出
- ✅ 未认证访问保护

缺失场景：
- ❌ 注册表单验证（邮箱格式、密码强度、必填项）
- ❌ 登录失败 - 用户不存在
- ❌ Token 过期处理
- ❌ GitHub OAuth 流程
- ❌ GitLab OAuth 流程
- ❌ 记住登录状态
- ❌ 并发登录处理

---

## 文件结构

```
packages/e2e/
├── tests/
│   └── auth.spec.ts          # 认证测试（修改）
├── helpers/
│   ├── test-server.ts        # 测试服务器（ORM 重写）
│   └── test-db.ts            # 测试数据库辅助
└── fixtures/
    └── base.ts               # 自定义 fixtures
```

---

## Task 1: 重写测试服务器使用 Drizzle ORM

**Files:**
- Modify: `packages/e2e/helpers/test-server.ts`

- [ ] **Step 1: 重写测试服务器核心代码**

将 `test-server.ts` 完全重写为使用 Drizzle ORM：

```typescript
// packages/e2e/helpers/test-server.ts
import { createServer, Server } from 'http';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { AddressInfo } from 'net';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  drafts,
  draftMembers,
  draftMessages,
} from '@code-link/server/dist/db/schema/index.js';

export const TEST_JWT_SECRET = 'test-secret-key-for-e2e';

const schema = { users, organizations, organizationMembers, projects, drafts, draftMembers, draftMessages };

export interface TestServer {
  server: Server;
  port: number;
  baseUrl: string;
  db: Database.Database;
  orm: ReturnType<typeof drizzle>;
}

/**
 * 创建测试 Express 应用（使用 Drizzle ORM）
 */
export function createTestApp(sqlite: Database.Database): express.Express {
  const app = express();
  const db = drizzle(sqlite, { schema });

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    try {
      // 检查邮箱是否已存在
      const existing = await db.select().from(users).where(eq(users.email, email)).get();
      if (existing) {
        res.status(409).json({ error: '该邮箱已被注册' });
        return;
      }

      // 创建用户
      const passwordHash = bcrypt.hashSync(password, 10);
      const [newUser] = await db.insert(users).values({
        name,
        email,
        passwordHash,
      }).returning();

      // 生成 JWT token
      const token = jwt.sign({ userId: newUser.id }, TEST_JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        data: {
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            avatar: newUser.avatar,
            createdAt: newUser.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: '注册失败' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: '缺少邮箱或密码' });
      return;
    }

    try {
      const user = await db.select().from(users).where(eq(users.email, email)).get();
      if (!user) {
        res.status(401).json({ error: '认证失败' });
        return;
      }

      const valid = bcrypt.compareSync(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: '认证失败' });
        return;
      }

      const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, { expiresIn: '7d' });

      res.json({
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: '登录失败' });
    }
  });

  app.get('/api/auth/me', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }
      res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({ error: '获取用户信息失败' });
    }
  });

  // Projects routes
  app.get('/api/projects', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    try {
      const result = await db
        .select()
        .from(projects)
        .innerJoin(organizationMembers, eq(projects.organizationId, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(desc(projects.createdAt))
        .all();

      const projectList = result.map(({ projects: p, organization_members: om }) => ({
        ...p,
        memberRole: om.role,
      }));

      res.json({ data: projectList });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: '获取项目列表失败' });
    }
  });

  app.post('/api/projects', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { name, templateType, organizationId } = req.body;

    if (!name) {
      res.status(400).json({ error: '缺少项目名称' });
      return;
    }

    if (!organizationId) {
      res.status(400).json({ error: '缺少组织 ID' });
      return;
    }

    try {
      // 检查用户是否是组织成员
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限在此组织创建项目' });
        return;
      }

      const [newProject] = await db.insert(projects).values({
        name,
        templateType: templateType || 'node',
        organizationId,
        createdBy: userId,
        status: 'created',
      }).returning();

      res.status(201).json({ data: newProject });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: '创建项目失败' });
    }
  });

  app.delete('/api/projects/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      // 获取项目所属组织
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查用户是否是组织成员
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限删除此项目' });
        return;
      }

      await db.delete(projects).where(eq(projects.id, projectId));
      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: '删除项目失败' });
    }
  });

  // Organizations routes
  app.get('/api/organizations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    try {
      const result = await db
        .select()
        .from(organizations)
        .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(desc(organizations.createdAt))
        .all();

      const orgList = result.map(({ organizations: o, organization_members: om }) => ({
        ...o,
        memberRole: om.role,
      }));

      res.json({ data: orgList });
    } catch (error) {
      res.status(500).json({ error: '获取组织列表失败' });
    }
  });

  app.post('/api/organizations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: '缺少组织名称' });
      return;
    }

    try {
      const [newOrg] = await db.insert(organizations).values({
        name,
        createdBy: userId,
      }).returning();

      await db.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId,
        role: 'owner',
        invitedBy: userId,
      });

      res.status(201).json({ data: newOrg });
    } catch (error) {
      console.error('Create organization error:', error);
      res.status(500).json({ error: '创建组织失败' });
    }
  });

  // Drafts routes
  app.get('/api/drafts', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : null;

    try {
      let result;
      if (projectId) {
        result = await db
          .select()
          .from(drafts)
          .innerJoin(draftMembers, eq(drafts.id, draftMembers.draftId))
          .where(and(
            eq(draftMembers.userId, userId),
            eq(drafts.projectId, projectId)
          ))
          .orderBy(desc(drafts.updatedAt))
          .all();
      } else {
        result = await db
          .select()
          .from(drafts)
          .innerJoin(draftMembers, eq(drafts.id, draftMembers.draftId))
          .where(eq(draftMembers.userId, userId))
          .orderBy(desc(drafts.updatedAt))
          .all();
      }

      const draftList = result.map(({ drafts: d, draft_members: dm }) => ({
        ...d,
        memberRole: dm.role,
      }));

      res.json({ data: draftList });
    } catch (error) {
      res.status(500).json({ error: '获取草稿列表失败' });
    }
  });

  app.post('/api/drafts', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { projectId, title } = req.body;

    if (!projectId || !title) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    try {
      const [newDraft] = await db.insert(drafts).values({
        projectId,
        title,
        status: 'discussing',
        createdBy: userId,
      }).returning();

      await db.insert(draftMembers).values({
        draftId: newDraft.id,
        userId,
        role: 'owner',
      });

      res.status(201).json({ data: newDraft });
    } catch (error) {
      console.error('Create draft error:', error);
      res.status(500).json({ error: '创建草稿失败' });
    }
  });

  // Draft messages
  app.get('/api/drafts/:draftId/messages', authMiddleware(db), async (req, res) => {
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的草稿 ID' });
      return;
    }

    try {
      const messages = await db
        .select()
        .from(draftMessages)
        .leftJoin(users, eq(draftMessages.userId, users.id))
        .where(eq(draftMessages.draftId, draftId))
        .orderBy(draftMessages.createdAt)
        .all();

      const messageList = messages.map(({ draft_messages: dm, users: u }) => ({
        ...dm,
        userName: u?.name,
        userEmail: u?.email,
      }));

      res.json({ data: messageList });
    } catch (error) {
      res.status(500).json({ error: '获取消息列表失败' });
    }
  });

  app.post('/api/drafts/:draftId/messages', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { content, messageType, parentId } = req.body;

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的草稿 ID' });
      return;
    }

    if (!content) {
      res.status(400).json({ error: '缺少消息内容' });
      return;
    }

    try {
      const [newMessage] = await db.insert(draftMessages).values({
        draftId,
        userId,
        content,
        messageType: messageType || 'text',
        parentId: parentId ?? null,
      }).returning();

      res.status(201).json({ data: newMessage });
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });

  // OAuth mock routes
  app.get('/api/auth/github/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: '缺少授权码' });
      return;
    }

    const email = `github-${code}@example.com`;
    let user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
      const [newUser] = await db.insert(users).values({
        name: `GitHub User ${code}`,
        email,
        passwordHash: '',
        avatar: `https://github.com/avatar/${code}.png`,
      }).returning();
      user = newUser;
    }

    const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, { expiresIn: '7d' });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      },
    });
  });

  app.get('/api/auth/gitlab/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: '缺少授权码' });
      return;
    }

    const email = `gitlab-${code}@example.com`;
    let user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
      const [newUser] = await db.insert(users).values({
        name: `GitLab User ${code}`,
        email,
        passwordHash: '',
        avatar: `https://gitlab.com/avatar/${code}.png`,
      }).returning();
      user = newUser;
    }

    const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, { expiresIn: '7d' });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      },
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

/**
 * 认证中间件
 */
function authMiddleware(db: ReturnType<typeof drizzle>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }

    const token = header.slice(7);
    if (!token) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }

    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET);
      if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
        res.status(401).json({ error: '无效的认证令牌' });
        return;
      }
      (req as any).userId = payload.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: '无效的认证令牌' });
    }
  };
}

/**
 * 启动测试服务器
 */
export async function startTestServer(sqlite: Database.Database): Promise<TestServer> {
  const app = createTestApp(sqlite);
  const server = createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      const db = drizzle(sqlite, { schema });
      resolve({
        server,
        port,
        baseUrl: `http://localhost:${port}`,
        db: sqlite,
        orm: db,
      });
    });

    server.on('error', reject);
  });
}

/**
 * 关闭测试服务器
 */
export async function stopTestServer(testServer: TestServer): Promise<void> {
  return new Promise((resolve, reject) => {
    testServer.server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 生成测试 JWT token
 */
export function generateTestToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

/**
 * 生成已过期的测试 JWT token
 */
export function generateExpiredToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '-1h' });
}
```

- [ ] **Step 2: 更新 test-db.ts 使用 Drizzle ORM**

```typescript
// packages/e2e/helpers/test-db.ts
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initSchema } from '@code-link/server/dist/db/init.js';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  drafts,
  draftMembers,
  draftMessages,
} from '@code-link/server/dist/db/schema/index.js';

const schema = { users, organizations, organizationMembers, projects, drafts, draftMembers, draftMessages };

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

  const [result] = await db.insert(users).values({
    name,
    email,
    passwordHash,
  }).returning();

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

  const [result] = await db.insert(organizations).values({
    name: orgName,
    createdBy: userId,
  }).returning();

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
  organizationId?: number | null,
  overrides?: { name?: string; templateType?: 'node' | 'node+java' | 'node+python'; status?: string }
): Promise<number> {
  const projectName = overrides?.name || 'Test Project';
  const templateType = overrides?.templateType || 'node';
  const status = overrides?.status || 'created';

  // 如果没有提供 organizationId，创建一个组织
  let orgId = organizationId;
  if (orgId === undefined || orgId === null) {
    orgId = await seedTestOrganization(db, userId, `${projectName} Org`);
  }

  const [result] = await db.insert(projects).values({
    name: projectName,
    templateType,
    organizationId: orgId,
    createdBy: userId,
    status: status as 'created' | 'running' | 'stopped',
  }).returning();

  return result.id;
}

/**
 * 创建测试草稿
 */
export async function seedTestDraft(
  db: ReturnType<typeof drizzle>,
  projectId: number,
  userId: number,
  overrides?: { title?: string; status?: string }
): Promise<number> {
  const title = overrides?.title || 'Test Draft';
  const status = overrides?.status || 'discussing';

  const [result] = await db.insert(drafts).values({
    projectId,
    title,
    status: status as 'discussing' | 'brainstorming' | 'reviewing' | 'developing' | 'confirmed' | 'archived',
    createdBy: userId,
  }).returning();

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
  db: ReturnType<typeof drizzle>,
  draftId: number,
  userId: number,
  content: string
): Promise<number> {
  const [result] = await db.insert(draftMessages).values({
    draftId,
    userId,
    content,
    messageType: 'text',
  }).returning();

  return result.id;
}

/**
 * 关闭数据库连接
 */
export function closeTestDb(sqlite: Database.Database): void {
  sqlite.close();
}
```

- [ ] **Step 3: 更新 fixtures/base.ts**

```typescript
// packages/e2e/fixtures/base.ts
import { test as base, Page, BrowserContext } from '@playwright/test';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createTestDb, seedTestUser, TestUser, closeTestDb } from '../helpers/test-db';
import { startTestServer, stopTestServer, TestServer, generateTestToken } from '../helpers/test-server';

export interface E2EFixtures {
  testServer: TestServer;
  testUser: TestUser;
  webBaseUrl: string;
}

let globalTestServer: TestServer | null = null;
let globalTestDb: { sqlite: Database.Database; db: ReturnType<typeof drizzle> } | null = null;

export const test = base.extend<E2EFixtures>({
  testServer: async ({}, use) => {
    if (!globalTestServer) {
      globalTestDb = createTestDb();
      globalTestServer = await startTestServer(globalTestDb.sqlite);
    }
    await use(globalTestServer);
  },

  testUser: async ({ testServer }, use) => {
    const user = await seedTestUser(testServer.orm);
    await use(user);
  },

  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
  },
});

export const authTest = base.extend<E2EFixtures>({
  testServer: async ({}, use) => {
    if (!globalTestServer) {
      globalTestDb = createTestDb();
      globalTestServer = await startTestServer(globalTestDb.sqlite);
    }
    await use(globalTestServer);
  },

  testUser: async ({ testServer }, use) => {
    const user = await seedTestUser(testServer.orm);
    await use(user);
  },

  webBaseUrl: async ({}, use) => {
    await use(process.env.WEB_BASE_URL || 'http://localhost:3000');
  },
});

export async function cleanupGlobalResources() {
  if (globalTestServer) {
    await stopTestServer(globalTestServer);
    globalTestServer = null;
  }
  if (globalTestDb) {
    closeTestDb(globalTestDb.sqlite);
    globalTestDb = null;
  }
}

export { expect } from '@playwright/test';

export async function createAuthenticatedContext(
  browser: any,
  testServer: TestServer,
  user: TestUser
): Promise<{ context: BrowserContext; page: Page }> {
  const token = generateTestToken(user.id);
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((tokenValue) => {
    localStorage.setItem('token', tokenValue);
  }, token);

  return { context, page };
}

export async function loginAsUser(
  page: Page,
  webBaseUrl: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${webBaseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}
```

- [ ] **Step 4: 运行类型检查**

```bash
cd /root/my/code-link && pnpm --filter @code-link/e2e exec tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git -C /root/my/code-link add packages/e2e/helpers/test-server.ts packages/e2e/helpers/test-db.ts packages/e2e/fixtures/base.ts
git -C /root/my/code-link commit -m "refactor(e2e): migrate test server and helpers to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 更新认证测试使用 ORM

**Files:**
- Modify: `packages/e2e/tests/auth.spec.ts`

- [ ] **Step 1: 重写 auth.spec.ts 使用 ORM**

```typescript
// packages/e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { createTestDb, seedTestUser, closeTestDb } from '../helpers/test-db';
import { startTestServer, stopTestServer, generateTestToken, generateExpiredToken } from '../helpers/test-server';
import type Database from 'better-sqlite3';

let testServer: Awaited<ReturnType<typeof startTestServer>> | null = null;
let testDb: { sqlite: Database.Database; db: any } | null = null;

test.beforeAll(async () => {
  testDb = createTestDb();
  testServer = await startTestServer(testDb.sqlite);
});

test.afterAll(async () => {
  if (testServer) {
    await stopTestServer(testServer);
  }
  if (testDb) {
    closeTestDb(testDb.sqlite);
  }
});

test.describe('认证流程', () => {
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

  test('注册成功', async ({ page }) => {
    await page.route('**/api/auth/register', async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'test-token',
            user: {
              id: 1,
              name: body.name,
              email: body.email,
            },
          },
        }),
      });
    });

    await page.goto(`${webBaseUrl}/register`);
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[placeholder="用户名"]', 'NewUser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('注册失败 - 邮箱已存在', async ({ page }) => {
    await seedTestUser(testServer!.orm, { email: 'existing@example.com' });

    await page.goto(`${webBaseUrl}/register`);
    await page.fill('input[type="email"]', 'existing@example.com');
    await page.fill('input[placeholder="用户名"]', 'TestUser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=该邮箱已被注册')).toBeVisible({ timeout: 10000 });
  });

  test('注册失败 - 无效邮箱格式', async ({ page }) => {
    await page.goto(`${webBaseUrl}/register`);
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[placeholder="用户名"]', 'TestUser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(page).not.toHaveURL(/.*dashboard.*/);
  });

  test('注册失败 - 密码太短', async ({ page }) => {
    await page.goto(`${webBaseUrl}/register`);
    await page.fill('input[type="email"]', 'shortpass@example.com');
    await page.fill('input[placeholder="用户名"]', 'ShortPassUser');
    await page.fill('input[type="password"]', '123');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/密码.*至少.*字符/i')).toBeVisible({ timeout: 5000 });
  });

  test('注册失败 - 必填项为空', async ({ page }) => {
    await page.goto(`${webBaseUrl}/register`);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*register.*/);
  });

  test('登录成功', async ({ page }) => {
    const testUser = await seedTestUser(testServer!.orm, { email: 'login@example.com', password: 'testpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('登录失败 - 错误密码', async ({ page }) => {
    await seedTestUser(testServer!.orm, { email: 'wrongpass@example.com', password: 'correctpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', 'wrongpass@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=认证失败')).toBeVisible({ timeout: 10000 });
  });

  test('登录失败 - 用户不存在', async ({ page }) => {
    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'anypassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=认证失败')).toBeVisible({ timeout: 10000 });
  });

  test('登录失败 - 空凭证', async ({ page }) => {
    await page.goto(`${webBaseUrl}/login`);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('登出', async ({ page }) => {
    const testUser = await seedTestUser(testServer!.orm, { email: 'logout@example.com', password: 'testpassword' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.click('text=登出');
    await page.waitForURL('**/login');
  });

  test('未认证访问保护', async ({ page }) => {
    await page.goto(`${webBaseUrl}/dashboard`);
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('Token 过期处理', async ({ page }) => {
    const testUser = await seedTestUser(testServer!.orm, { email: 'expired@example.com' });

    const expiredToken = generateExpiredToken(testUser.id);
    await page.addInitScript((tokenValue) => {
      localStorage.setItem('token', tokenValue);
    }, expiredToken);

    await page.goto(`${webBaseUrl}/dashboard`);
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('记住登录状态 - 页面刷新后保持登录', async ({ page, context }) => {
    const testUser = await seedTestUser(testServer!.orm, { email: 'remember@example.com' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.reload();
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(page.locator(`text=${testUser.email}`)).toBeVisible({ timeout: 5000 });
  });

  test('多标签页登录状态同步', async ({ page, context }) => {
    const testUser = await seedTestUser(testServer!.orm, { email: 'multitab@example.com' });

    await page.goto(`${webBaseUrl}/login`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const newPage = await context.newPage();
    await newPage.goto(`${webBaseUrl}/dashboard`);
    await expect(newPage).toHaveURL(/.*dashboard.*/);
    await expect(newPage.locator(`text=${testUser.email}`)).toBeVisible({ timeout: 5000 });
    await newPage.close();
  });

  test('并发登录同一账户', async ({ browser }) => {
    const testUser = await seedTestUser(testServer!.orm, { email: 'concurrent@example.com' });

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await Promise.all([
      (async () => {
        await page1.goto(`${webBaseUrl}/login`);
        await page1.fill('input[type="email"]', testUser.email);
        await page1.fill('input[type="password"]', testUser.password);
        await page1.click('button[type="submit"]');
        await page1.waitForURL('**/dashboard', { timeout: 15000 });
      })(),
      (async () => {
        await page2.goto(`${webBaseUrl}/login`);
        await page2.fill('input[type="email"]', testUser.email);
        await page2.fill('input[type="password"]', testUser.password);
        await page2.click('button[type="submit"]');
        await page2.waitForURL('**/dashboard', { timeout: 15000 });
      })(),
    ]);

    await expect(page1.locator(`text=${testUser.email}`)).toBeVisible({ timeout: 5000 });
    await expect(page2.locator(`text=${testUser.email}`)).toBeVisible({ timeout: 5000 });

    await context1.close();
    await context2.close();
  });
});

test.describe('OAuth 登录', () => {
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

  test('GitHub OAuth 登录', async ({ page }) => {
    await page.route('**/api/auth/github/callback**', async (route) => {
      const url = new URL(route.request().url());
      const code = url.searchParams.get('code') || 'test-code';

      const response = await fetch(`${testServer!.baseUrl}/api/auth/github/callback?code=${code}`);
      const body = await response.json();

      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto(`${webBaseUrl}/login`);
    await page.click('button:has-text("GitHub"), a:has-text("GitHub")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('GitLab OAuth 登录', async ({ page }) => {
    await page.route('**/api/auth/gitlab/callback**', async (route) => {
      const url = new URL(route.request().url());
      const code = url.searchParams.get('code') || 'test-code';

      const response = await fetch(`${testServer!.baseUrl}/api/auth/gitlab/callback?code=${code}`);
      const body = await response.json();

      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto(`${webBaseUrl}/login`);
    await page.click('button:has-text("GitLab"), a:has-text("GitLab")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });
});
```

- [ ] **Step 2: 运行测试验证**

```bash
cd /root/my/code-link && pnpm test:e2e -- --project=auth-tests
```

Expected: 所有认证测试通过

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/e2e/tests/auth.spec.ts
git -C /root/my/code-link commit -m "test(e2e): update auth tests to use Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 测试覆盖清单

| 测试场景 | 状态 |
|---------|------|
| 注册成功 | ✅ 已有 |
| 注册失败 - 邮箱已存在 | ✅ 已有 |
| 注册失败 - 无效邮箱格式 | 🆕 新增 |
| 注册失败 - 密码太短 | 🆕 新增 |
| 注册失败 - 必填项为空 | 🆕 新增 |
| 登录成功 | ✅ 已有 |
| 登录失败 - 错误密码 | ✅ 已有 |
| 登录失败 - 用户不存在 | 🆕 新增 |
| 登录失败 - 空凭证 | 🆕 新增 |
| 登出 | ✅ 已有 |
| 未认证访问保护 | ✅ 已有 |
| Token 过期处理 | 🆕 新增 |
| GitHub OAuth | 🆕 新增 |
| GitLab OAuth | 🆕 新增 |
| 记住登录状态 | 🆕 新增 |
| 多标签页状态同步 | 🆕 新增 |
| 并发登录 | 🆕 新增 |
