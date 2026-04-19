# 多人协作模块实现计划（Phase 1: 数据层与基础 API）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立协作模块的数据基础：数据库 schema 和 Draft CRUD API。

**Architecture:** 扩展现有 SQLite schema 添加 drafts、draft_members、draft_messages、message_confirmations 表；创建 drafts 路由提供 REST API。

**Tech Stack:** Express, better-sqlite3, TypeScript

---

## 文件结构

```
packages/server/
├── src/
│   ├── db/
│   │   └── schema.ts          # 修改：添加 Draft 相关表
│   ├── routes/
│   │   └── drafts.ts          # 新增：Draft API 路由
│   ├── types/
│   │   └── draft.ts           # 新增：Draft 类型定义
│   └── index.ts               # 修改：注册 drafts 路由
└── tests/
    └── drafts.test.ts         # 新增：Draft API 测试
```

---

## Task 1: 定义 Draft 类型

**Files:**
- Create: `packages/server/src/types/draft.ts`

- [ ] **Step 1: 创建 Draft 类型定义文件**

```typescript
// packages/server/src/types/draft.ts

export type DraftStatus = 
  | 'discussing'
  | 'brainstorming'
  | 'reviewing'
  | 'developing'
  | 'confirmed'
  | 'archived';

export type DraftMemberRole = 'owner' | 'participant';

export type MessageType = 
  | 'text'
  | 'image'
  | 'code'
  | 'document_card'
  | 'ai_command'
  | 'system';

export type ConfirmationType = 'agree' | 'disagree' | 'suggest';

export interface Draft {
  id: number;
  project_id: number;
  title: string;
  status: DraftStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DraftMember {
  id: number;
  draft_id: number;
  user_id: number;
  role: DraftMemberRole;
  joined_at: string;
}

export interface DraftMessage {
  id: number;
  draft_id: number;
  parent_id: number | null;
  user_id: number;
  content: string;
  message_type: MessageType;
  metadata: string | null;  // JSON string
  created_at: string;
  updated_at: string;
}

export interface MessageConfirmation {
  id: number;
  message_id: number;
  user_id: number;
  type: ConfirmationType;
  comment: string | null;
  created_at: string;
}

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

export interface UpdateDraftInput {
  title?: string;
  status?: DraftStatus;
}

export interface CreateMessageInput {
  content: string;
  messageType: MessageType;
  parentId?: number;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/types/draft.ts
git commit -m "$(cat <<'EOF'
feat(server): add Draft type definitions

Define types for Draft, DraftMember, DraftMessage, MessageConfirmation
and related input types for the collaboration module.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 扩展数据库 Schema

**Files:**
- Modify: `packages/server/src/db/schema.ts`

- [ ] **Step 1: 添加 Draft 相关表到 schema**

在 `initSchema` 函数的 `db.exec()` 调用中，在最后一个表定义后添加：

```typescript
// 在 user_claude_configs 表之后添加

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
      message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'code', 'document_card', 'ai_command', 'system')),
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/schema.ts
git commit -m "$(cat <<'EOF'
feat(server): add Draft database schema

Add tables for drafts, draft_members, draft_messages, and
message_confirmations with appropriate indexes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 编写 Draft API 测试

**Files:**
- Create: `packages/server/tests/drafts.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
// packages/server/tests/drafts.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../src/db/connection.js';
import { initSchema } from '../src/db/schema.js';
import { createDraftsRouter } from '../src/routes/drafts.js';
import { createAuthRouter } from '../src/routes/auth.js';
import supertest from 'supertest';

describe('Drafts API', () => {
  let db: Database.Database;
  let app: express.Express;
  let authToken: string;
  let userId: number;
  let projectId: number;

  beforeEach(async () => {
    db = getDb(':memory:');
    initSchema(db);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(db));
    app.use('/api/drafts', createDraftsRouter(db));

    // 创建测试用户
    const registerRes = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // 创建测试项目（直接插入数据库）
    const projectResult = db.prepare(
      'INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)'
    ).run('Test Project', 'node', userId);
    projectId = projectResult.lastInsertRowid as number;

    // 添加用户为项目成员
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(projectId, userId, 'owner');
  });

  afterEach(() => {
    closeDb(db);
  });

  describe('POST /api/drafts', () => {
    it('should create a draft with owner as member', async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });

      expect(res.status).toBe(201);
      expect(res.body.draft).toMatchObject({
        project_id: projectId,
        title: 'Test Draft',
        status: 'discussing',
        created_by: userId,
      });
      expect(res.body.draft.id).toBeDefined();

      // 验证创建者是 owner
      const members = db.prepare('SELECT * FROM draft_members WHERE draft_id = ?').all(res.body.draft.id);
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        user_id: userId,
        role: 'owner',
      });
    });

    it('should return 401 without auth token', async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .send({ projectId, title: 'Test Draft' });

      expect(res.status).toBe(401);
    });

    it('should return 400 without required fields', async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/drafts/:draftId', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;
    });

    it('should return draft with members', async () => {
      const res = await supertest(app)
        .get(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.draft.id).toBe(draftId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].user_id).toBe(userId);
    });

    it('should return 404 for non-existent draft', async () => {
      const res = await supertest(app)
        .get('/api/drafts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/drafts', () => {
    beforeEach(async () => {
      await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Draft 1' });
      await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Draft 2' });
    });

    it('should return all drafts for user', async () => {
      const res = await supertest(app)
        .get('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drafts).toHaveLength(2);
    });
  });

  describe('POST /api/drafts/:draftId/members', () => {
    let draftId: number;
    let anotherUserId: number;

    beforeEach(async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;

      // 创建另一个用户
      const anotherRes = await supertest(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'another@test.com', password: 'password123' });
      anotherUserId = anotherRes.body.user.id;

      // 添加为项目成员
      db.prepare(
        'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
      ).run(projectId, anotherUserId, 'developer');
    });

    it('should add member to draft', async () => {
      const res = await supertest(app)
        .post(`/api/drafts/${draftId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: anotherUserId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const members = db.prepare('SELECT * FROM draft_members WHERE draft_id = ?').all(draftId);
      expect(members).toHaveLength(2);
    });
  });

  describe('PUT /api/drafts/:draftId/status', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;
    });

    it('should update draft status', async () => {
      const res = await supertest(app)
        .put(`/api/drafts/${draftId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'brainstorming' });

      expect(res.status).toBe(200);
      expect(res.body.draft.status).toBe('brainstorming');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && npm test -- drafts.test.ts
```

Expected: FAIL - `createDraftsRouter` not found

- [ ] **Step 3: Commit**

```bash
git add packages/server/tests/drafts.test.ts
git commit -m "$(cat <<'EOF'
test(server): add Draft API tests

Add comprehensive tests for draft CRUD operations including
create, read, update status, and member management.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 实现 Drafts 路由

**Files:**
- Create: `packages/server/src/routes/drafts.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 创建 drafts 路由文件**

```typescript
// packages/server/src/routes/drafts.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import type { 
  Draft, 
  DraftMember, 
  DraftStatus,
  CreateDraftInput,
  UpdateDraftInput
} from '../types/draft.js';

export function createDraftsRouter(db: Database.Database): Router {
  const router = Router();
  router.use(authMiddleware);

  // 创建 Draft
  router.post('/', (req, res) => {
    const userId = (req as any).userId;
    const { projectId, title, memberIds } = req.body as CreateDraftInput;

    if (!projectId || !title) {
      res.status(400).json({ error: 'projectId 和 title 是必填项' });
      return;
    }

    // 检查用户是否是项目成员
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '您不是该项目的成员' });
      return;
    }

    try {
      // 创建 Draft
      const result = db.prepare(`
        INSERT INTO drafts (project_id, title, created_by)
        VALUES (?, ?, ?)
      `).run(projectId, title, userId);

      const draftId = result.lastInsertRowid as number;

      // 添加创建者为 owner
      db.prepare(`
        INSERT INTO draft_members (draft_id, user_id, role)
        VALUES (?, ?, 'owner')
      `).run(draftId, userId);

      // 添加其他成员
      if (memberIds && memberIds.length > 0) {
        const addMember = db.prepare(`
          INSERT OR IGNORE INTO draft_members (draft_id, user_id, role)
          VALUES (?, ?, 'participant')
        `);

        for (const memberId of memberIds) {
          // 检查是否是项目成员
          const isProjectMember = db
            .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
            .get(projectId, memberId);
          
          if (isProjectMember) {
            addMember.run(draftId, memberId);
          }
        }
      }

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;
      res.status(201).json({ draft });
    } catch (error) {
      console.error('Failed to create draft:', error);
      res.status(500).json({ error: '创建 Draft 失败' });
    }
  });

  // 获取用户的所有 Draft
  router.get('/', (req, res) => {
    const userId = (req as any).userId;
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

    try {
      let query = `
        SELECT d.* FROM drafts d
        JOIN draft_members dm ON d.id = dm.draft_id
        WHERE dm.user_id = ?
      `;
      const params: (number | string)[] = [userId];

      if (projectId) {
        query += ' AND d.project_id = ?';
        params.push(projectId);
      }

      query += ' ORDER BY d.updated_at DESC';

      const drafts = db.prepare(query).all(...params) as Draft[];
      res.json({ drafts });
    } catch (error) {
      console.error('Failed to get drafts:', error);
      res.status(500).json({ error: '获取 Draft 列表失败' });
    }
  });

  // 获取 Draft 详情
  router.get('/:draftId', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 draftId' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft | undefined;

      if (!draft) {
        res.status(404).json({ error: 'Draft 不存在' });
        return;
      }

      // 获取成员列表
      const members = db.prepare(`
        SELECT dm.*, u.name as user_name, u.email as user_email
        FROM draft_members dm
        JOIN users u ON dm.user_id = u.id
        WHERE dm.draft_id = ?
      `).all(draftId);

      res.json({ draft, members });
    } catch (error) {
      console.error('Failed to get draft:', error);
      res.status(500).json({ error: '获取 Draft 详情失败' });
    }
  });

  // 更新 Draft 状态
  router.put('/:draftId/status', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { status } = req.body as { status: DraftStatus };

    if (isNaN(draftId) || !status) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as DraftMember | undefined;

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      db.prepare(`
        UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?
      `).run(status, draftId);

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;
      res.json({ draft });
    } catch (error) {
      console.error('Failed to update draft status:', error);
      res.status(500).json({ error: '更新 Draft 状态失败' });
    }
  });

  // 添加成员
  router.post('/:draftId/members', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { userId: newMemberId } = req.body;

    if (isNaN(draftId) || !newMemberId) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查当前用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      // 获取 Draft 的项目 ID
      const draft = db.prepare('SELECT project_id FROM drafts WHERE id = ?').get(draftId) as { project_id: number } | undefined;

      if (!draft) {
        res.status(404).json({ error: 'Draft 不存在' });
        return;
      }

      // 检查新成员是否是项目成员
      const isProjectMember = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(draft.project_id, newMemberId);

      if (!isProjectMember) {
        res.status(400).json({ error: '该用户不是项目成员' });
        return;
      }

      // 添加成员
      db.prepare(`
        INSERT OR IGNORE INTO draft_members (draft_id, user_id, role)
        VALUES (?, ?, 'participant')
      `).run(draftId, newMemberId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to add member:', error);
      res.status(500).json({ error: '添加成员失败' });
    }
  });

  // 移除成员
  router.delete('/:draftId/members/:userId', (req, res) => {
    const currentUserId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(draftId) || isNaN(targetUserId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查当前用户是否是 Draft owner
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, currentUserId) as DraftMember | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有 owner 可以移除成员' });
        return;
      }

      // 不能移除 owner
      const targetMembership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, targetUserId) as DraftMember | undefined;

      if (targetMembership?.role === 'owner') {
        res.status(400).json({ error: '不能移除 owner' });
        return;
      }

      db.prepare('DELETE FROM draft_members WHERE draft_id = ? AND user_id = ?').run(draftId, targetUserId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to remove member:', error);
      res.status(500).json({ error: '移除成员失败' });
    }
  });

  // 删除 Draft
  router.delete('/:draftId', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 draftId' });
      return;
    }

    try {
      // 检查用户是否是 Draft owner
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as DraftMember | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有 owner 可以删除 Draft' });
        return;
      }

      db.prepare('DELETE FROM drafts WHERE id = ?').run(draftId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete draft:', error);
      res.status(500).json({ error: '删除 Draft 失败' });
    }
  });

  return router;
}
```

- [ ] **Step 2: 在 index.ts 注册路由**

在 `packages/server/src/index.ts` 中添加导入和路由注册：

```typescript
// 在导入部分添加
import { createDraftsRouter } from './routes/drafts.js';

// 在路由注册部分添加（其他 app.use 之后）
app.use('/api/drafts', createDraftsRouter(db));
```

- [ ] **Step 3: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && npm test -- drafts.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/drafts.ts packages/server/src/index.ts
git commit -m "$(cat <<'EOF'
feat(server): implement Draft API routes

Add CRUD endpoints for drafts with member management:
- POST /api/drafts - create draft
- GET /api/drafts - list user's drafts
- GET /api/drafts/:draftId - get draft details
- PUT /api/drafts/:draftId/status - update status
- POST /api/drafts/:draftId/members - add member
- DELETE /api/drafts/:draftId/members/:userId - remove member
- DELETE /api/drafts/:draftId - delete draft

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 实现 Draft 消息 API

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`
- Modify: `packages/server/tests/drafts.test.ts`

- [ ] **Step 1: 添加消息相关路由到 drafts.ts**

在 `createDraftsRouter` 函数的 `return router;` 之前添加：

```typescript
  // 获取 Draft 消息列表
  router.get('/:draftId/messages', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const before = req.query.before as string | undefined;

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 draftId' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      let query = `
        SELECT m.*, u.name as user_name
        FROM draft_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.draft_id = ?
      `;
      const params: (number | string | null)[] = [draftId];

      if (parentId !== undefined) {
        if (parentId === null || parentId === 0) {
          query += ' AND m.parent_id IS NULL';
        } else {
          query += ' AND m.parent_id = ?';
          params.push(parentId);
        }
      }

      if (before) {
        query += ' AND m.created_at < ?';
        params.push(before);
      }

      query += ' ORDER BY m.created_at ASC LIMIT ?';
      params.push(limit);

      const messages = db.prepare(query).all(...params);
      res.json({ messages });
    } catch (error) {
      console.error('Failed to get messages:', error);
      res.status(500).json({ error: '获取消息失败' });
    }
  });

  // 发送消息
  router.post('/:draftId/messages', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { content, messageType, parentId, metadata } = req.body;

    if (isNaN(draftId) || !content) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      const result = db.prepare(`
        INSERT INTO draft_messages (draft_id, parent_id, user_id, content, message_type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        draftId,
        parentId || null,
        userId,
        content,
        messageType || 'text',
        metadata ? JSON.stringify(metadata) : null
      );

      const messageId = result.lastInsertRowid as number;

      // 更新 draft 的 updated_at
      db.prepare(`UPDATE drafts SET updated_at = datetime('now') WHERE id = ?`).run(draftId);

      const message = db.prepare(`
        SELECT m.*, u.name as user_name
        FROM draft_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `).get(messageId);

      res.status(201).json({ message });
    } catch (error) {
      console.error('Failed to send message:', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });

  // 确认消息（点赞/反对）
  router.post('/:draftId/messages/:messageId/confirm', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const { type, comment } = req.body;

    if (isNaN(draftId) || isNaN(messageId) || !type) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      // 检查消息是否属于该 Draft
      const message = db
        .prepare('SELECT * FROM draft_messages WHERE id = ? AND draft_id = ?')
        .get(messageId, draftId);

      if (!message) {
        res.status(404).json({ error: '消息不存在' });
        return;
      }

      // 插入或更新确认
      db.prepare(`
        INSERT INTO message_confirmations (message_id, user_id, type, comment)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(message_id, user_id) DO UPDATE SET
          type = excluded.type,
          comment = excluded.comment,
          created_at = datetime('now')
      `).run(messageId, userId, type, comment || null);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to confirm message:', error);
      res.status(500).json({ error: '确认消息失败' });
    }
  });

  // 获取消息确认列表
  router.get('/:draftId/messages/:messageId/confirmations', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(draftId) || isNaN(messageId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      const confirmations = db.prepare(`
        SELECT mc.*, u.name as user_name
        FROM message_confirmations mc
        JOIN users u ON mc.user_id = u.id
        WHERE mc.message_id = ?
        ORDER BY mc.created_at ASC
      `).all(messageId);

      res.json({ confirmations });
    } catch (error) {
      console.error('Failed to get confirmations:', error);
      res.status(500).json({ error: '获取确认列表失败' });
    }
  });
```

- [ ] **Step 2: 添加消息测试到 drafts.test.ts**

在测试文件末尾的 `describe('PUT /api/drafts/:draftId/status'...` 块之后添加：

```typescript
  describe('POST /api/drafts/:draftId/messages', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;
    });

    it('should send a text message', async () => {
      const res = await supertest(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello world' });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatchObject({
        draft_id: draftId,
        user_id: userId,
        content: 'Hello world',
        message_type: 'text',
      });
    });

    it('should send a message with parent (thread)', async () => {
      // 先发送一条消息
      const parentRes = await supertest(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Parent message' });

      // 回复这条消息
      const res = await supertest(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Reply message', parentId: parentRes.body.message.id });

      expect(res.status).toBe(201);
      expect(res.body.message.parent_id).toBe(parentRes.body.message.id);
    });
  });

  describe('POST /api/drafts/:draftId/messages/:messageId/confirm', () => {
    let draftId: number;
    let messageId: number;

    beforeEach(async () => {
      const draftRes = await supertest(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = draftRes.body.draft.id;

      const msgRes = await supertest(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Test message' });
      messageId = msgRes.body.message.id;
    });

    it('should confirm a message with agree', async () => {
      const res = await supertest(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'agree' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const confRes = await supertest(app)
        .get(`/api/drafts/${draftId}/messages/${messageId}/confirmations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(confRes.body.confirmations).toHaveLength(1);
      expect(confRes.body.confirmations[0]).toMatchObject({
        user_id: userId,
        type: 'agree',
      });
    });
  });
```

- [ ] **Step 3: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && npm test -- drafts.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/drafts.ts packages/server/tests/drafts.test.ts
git commit -m "$(cat <<'EOF'
feat(server): add Draft message API endpoints

Add endpoints for draft messaging:
- GET /api/drafts/:draftId/messages - list messages
- POST /api/drafts/:draftId/messages - send message
- POST /api/drafts/:draftId/messages/:messageId/confirm - confirm message
- GET /api/drafts/:draftId/messages/:messageId/confirmations - get confirmations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成检查

- [ ] 所有测试通过
- [ ] API 端点完整实现
- [ ] 代码已提交

---

**Phase 1 完成。后续 Phase 将包括：**
- Phase 2: WebSocket 实时消息推送
- Phase 3: 前端协作面板 UI
- Phase 4: @AI 指令集成
- Phase 5: Yjs/Hocuspocus 实时同步
