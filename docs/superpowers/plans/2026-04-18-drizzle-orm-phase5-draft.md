# Drizzle ORM 数据库重构 - Phase 5: Draft 模块

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Draft 模块，使用 Drizzle ORM 替代原生 SQL，创建 Repository 和 Service 层。

**Architecture:** 三层架构 - Repository（数据访问）、Service（业务逻辑）、Routes（HTTP 处理）。类型安全的数据库操作。

**Tech Stack:** Drizzle ORM, Express, WebSocket

---

## 前置条件

- Phase 1 基础设施已完成
- Phase 2-4 前置模块已完成
- Schema 定义在 `packages/server/src/db/schema/`

---

### Task 1: 创建 Draft Repository

**Files:**
- Create: `packages/server/src/repositories/draft.repository.ts`
- Modify: `packages/server/src/repositories/index.ts`

- [ ] **Step 1: 创建 Draft Repository**

```typescript
// packages/server/src/repositories/draft.repository.ts
import { eq, and, sql } from 'drizzle-orm';
import { getDb, getSqliteDb } from '../db/index.js';
import {
  drafts,
  draftMembers,
  draftMessages,
  messageConfirmations,
  users,
} from '../db/schema/index.js';
import type {
  InsertDraft,
  SelectDraft,
  InsertDraftMember,
  SelectDraftMember,
  InsertDraftMessage,
  SelectDraftMessage,
  InsertMessageConfirmation,
  SelectMessageConfirmation,
} from '../db/schema/index.js';

export interface DraftMemberWithUser extends SelectDraftMember {
  userName: string;
}

export interface DraftMessageWithUser extends SelectDraftMessage {
  userName: string | null;
}

export class DraftRepository {
  /**
   * 根据 ID 查找 Draft
   */
  async findById(draftId: number): Promise<SelectDraft | undefined> {
    const db = getDb();
    return db.select().from(drafts).where(eq(drafts.id, draftId)).get();
  }

  /**
   * 创建 Draft
   */
  async create(data: InsertDraft): Promise<SelectDraft> {
    const db = getDb();
    return db.insert(drafts).values(data).returning().get();
  }

  /**
   * 更新 Draft 状态
   */
  async updateStatus(draftId: number, status: string): Promise<SelectDraft> {
    const db = getDb();
    return db.update(drafts)
      .set({ status, updatedAt: sql`datetime('now')` })
      .where(eq(drafts.id, draftId))
      .returning()
      .get();
  }

  /**
   * 更新 Draft updatedAt
   */
  async touch(draftId: number): Promise<void> {
    const db = getDb();
    db.update(drafts)
      .set({ updatedAt: sql`datetime('now')` })
      .where(eq(drafts.id, draftId))
      .run();
  }

  /**
   * 删除 Draft
   */
  async delete(draftId: number): Promise<void> {
    const db = getDb();
    db.delete(drafts).where(eq(drafts.id, draftId)).run();
  }

  /**
   * 获取用户参与的 Draft 列表
   */
  async findByUserId(userId: number): Promise<SelectDraft[]> {
    const db = getDb();
    return db.select({
      id: drafts.id,
      projectId: drafts.projectId,
      title: drafts.title,
      status: drafts.status,
      createdBy: drafts.createdBy,
      createdAt: drafts.createdAt,
      updatedAt: drafts.updatedAt,
    })
      .from(drafts)
      .innerJoin(draftMembers, eq(drafts.id, draftMembers.draftId))
      .where(eq(draftMembers.userId, userId));
  }

  // === Draft Members ===

  /**
   * 查找 Draft 成员
   */
  async findMember(draftId: number, userId: number): Promise<SelectDraftMember | undefined> {
    const db = getDb();
    return db.select()
      .from(draftMembers)
      .where(and(
        eq(draftMembers.draftId, draftId),
        eq(draftMembers.userId, userId)
      ))
      .get();
  }

  /**
   * 查找 Draft 所有成员（带用户信息）
   */
  async findMembers(draftId: number): Promise<DraftMemberWithUser[]> {
    const db = getDb();
    return db.select({
      id: draftMembers.id,
      draftId: draftMembers.draftId,
      userId: draftMembers.userId,
      role: draftMembers.role,
      joinedAt: draftMembers.joinedAt,
      userName: users.name,
    })
      .from(draftMembers)
      .innerJoin(users, eq(draftMembers.userId, users.id))
      .where(eq(draftMembers.draftId, draftId));
  }

  /**
   * 添加 Draft 成员
   */
  async addMember(data: InsertDraftMember): Promise<SelectDraftMember> {
    const db = getDb();
    return db.insert(draftMembers).values(data).returning().get();
  }

  /**
   * 删除 Draft 成员
   */
  async removeMember(draftId: number, userId: number): Promise<void> {
    const db = getDb();
    db.delete(draftMembers)
      .where(and(
        eq(draftMembers.draftId, draftId),
        eq(draftMembers.userId, userId)
      ))
      .run();
  }

  /**
   * 创建 Draft 并添加创建者为 owner（事务）
   */
  async createWithOwner(data: InsertDraft, userId: number): Promise<SelectDraft> {
    const sqliteDb = getSqliteDb();
    const db = getDb();

    const result = sqliteDb.transaction(() => {
      const draft = db.insert(drafts).values(data).returning().get();

      db.insert(draftMembers).values({
        draftId: draft.id,
        userId,
        role: 'owner',
      }).run();

      return draft;
    })();

    return result;
  }

  // === Draft Messages ===

  /**
   * 创建消息
   */
  async createMessage(data: InsertDraftMessage): Promise<SelectDraftMessage> {
    const db = getDb();
    return db.insert(draftMessages).values(data).returning().get();
  }

  /**
   * 查找消息
   */
  async findMessage(messageId: number, draftId: number): Promise<SelectDraftMessage | undefined> {
    const db = getDb();
    return db.select()
      .from(draftMessages)
      .where(and(
        eq(draftMessages.id, messageId),
        eq(draftMessages.draftId, draftId)
      ))
      .get();
  }

  /**
   * 获取 Draft 消息列表（带用户信息）
   */
  async findMessages(
    draftId: number,
    options: {
      parentId?: number | null;
      before?: string;
      limit?: number;
    } = {}
  ): Promise<DraftMessageWithUser[]> {
    const db = getDb();
    let query = db.select({
      id: draftMessages.id,
      draftId: draftMessages.draftId,
      parentId: draftMessages.parentId,
      userId: draftMessages.userId,
      content: draftMessages.content,
      messageType: draftMessages.messageType,
      metadata: draftMessages.metadata,
      createdAt: draftMessages.createdAt,
      updatedAt: draftMessages.updatedAt,
      userName: users.name,
    })
      .from(draftMessages)
      .leftJoin(users, eq(draftMessages.userId, users.id))
      .where(eq(draftMessages.draftId, draftId));

    // 处理 parentId 过滤
    if (options.parentId !== undefined) {
      if (options.parentId === null || options.parentId === 0) {
        query = query.where(and(
          eq(draftMessages.draftId, draftId),
          sql`${draftMessages.parentId} IS NULL`
        ));
      } else {
        query = query.where(and(
          eq(draftMessages.draftId, draftId),
          eq(draftMessages.parentId, options.parentId)
        ));
      }
    }

    // 处理时间过滤
    if (options.before) {
      query = query.where(and(
        eq(draftMessages.draftId, draftId),
        sql`${draftMessages.createdAt} < ${options.before}`
      ));
    }

    return query.limit(options.limit || 50);
  }

  // === Message Confirmations ===

  /**
   * 创建或更新确认
   */
  async upsertConfirmation(data: InsertMessageConfirmation): Promise<SelectMessageConfirmation> {
    const sqliteDb = getSqliteDb();

    sqliteDb.prepare(
      `INSERT INTO message_confirmations (message_id, user_id, type, comment)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id, user_id) DO UPDATE SET
         type = excluded.type,
         comment = excluded.comment,
         created_at = datetime('now')`
    ).run(data.messageId, data.userId, data.type, data.comment || null);

    const db = getDb();
    return db.select()
      .from(messageConfirmations)
      .where(and(
        eq(messageConfirmations.messageId, data.messageId),
        eq(messageConfirmations.userId, data.userId)
      ))
      .get()!;
  }

  /**
   * 获取消息的确认列表
   */
  async findConfirmations(messageId: number): Promise<Array<SelectMessageConfirmation & { userName: string }>> {
    const db = getDb();
    return db.select({
      id: messageConfirmations.id,
      messageId: messageConfirmations.messageId,
      userId: messageConfirmations.userId,
      type: messageConfirmations.type,
      comment: messageConfirmations.comment,
      createdAt: messageConfirmations.createdAt,
      userName: users.name,
    })
      .from(messageConfirmations)
      .innerJoin(users, eq(messageConfirmations.userId, users.id))
      .where(eq(messageConfirmations.messageId, messageId));
  }
}
```

- [ ] **Step 2: 更新 Repositories 导出**

```typescript
// packages/server/src/repositories/index.ts
export { UserRepository } from './user.repository.js';
export { OrganizationRepository } from './organization.repository.js';
export { ProjectRepository } from './project.repository.js';
export { DraftRepository } from './draft.repository.js';
export type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
} from './organization.repository.js';
export type {
  ProjectWithOrg,
  ProjectMemberWithUser,
  ProjectDetail,
} from './project.repository.js';
export type {
  DraftMemberWithUser,
  DraftMessageWithUser,
} from './draft.repository.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 2: 创建 Draft Service

**Files:**
- Create: `packages/server/src/services/draft.service.ts`
- Modify: `packages/server/src/services/index.ts`

- [ ] **Step 1: 创建 Draft Service**

由于 Draft 服务涉及 WebSocket 和 AI 命令处理，将保留原有逻辑但重构数据访问部分。

```typescript
// packages/server/src/services/draft.service.ts
import { DraftRepository } from '../repositories/draft.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import type { SelectDraft } from '../db/schema/index.js';
import type { DraftMemberWithUser, DraftMessageWithUser } from '../repositories/draft.repository.js';

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

export interface CreateMessageInput {
  content: string;
  messageType?: string;
  parentId?: number;
  metadata?: string;
}

export interface UpdateDraftStatusInput {
  status: string;
}

export interface ConfirmMessageInput {
  type: 'agree' | 'disagree' | 'suggest';
  comment?: string;
}

export interface DraftDetail {
  draft: SelectDraft;
  members: DraftMemberWithUser[];
}

export class DraftService {
  private draftRepo = new DraftRepository();
  private projectRepo = new ProjectRepository();
  private orgRepo = new OrganizationRepository();
  private userRepo = new UserRepository();

  /**
   * 创建 Draft
   */
  async create(userId: number, input: CreateDraftInput): Promise<SelectDraft> {
    if (!input.projectId || !input.title) {
      throw new Error('缺少必填字段：projectId, title');
    }

    if (typeof input.title !== 'string' || input.title.length > 200) {
      throw new Error('Draft 标题必须是 1-200 字符的字符串');
    }

    // 获取项目所属组织
    const project = await this.projectRepo.findById(input.projectId);
    if (!project || !project.organizationId) {
      throw new Error('项目不存在');
    }

    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership || !['owner', 'developer'].includes(membership.role)) {
        throw new Error('您没有权限在该项目下创建 Draft');
      }
    }

    // 创建 Draft 并添加创建者为 owner
    const draft = await this.draftRepo.createWithOwner({
      projectId: input.projectId,
      title: input.title,
      createdBy: userId,
    }, userId);

    // 添加其他成员
    if (input.memberIds && input.memberIds.length > 0) {
      for (const memberId of input.memberIds) {
        if (memberId !== userId) {
          // 验证成员是否为组织成员
          const isOrgMember = await this.orgRepo.findUserMembership(project.organizationId, memberId);
          if (isOrgMember) {
            await this.draftRepo.addMember({
              draftId: draft.id,
              userId: memberId,
              role: 'participant',
            });
          }
        }
      }
    }

    return draft;
  }

  /**
   * 获取用户参与的 Draft 列表
   */
  async findByUserId(userId: number): Promise<SelectDraft[]> {
    return this.draftRepo.findByUserId(userId);
  }

  /**
   * 获取 Draft 详情
   */
  async findById(draftId: number, userId: number): Promise<DraftDetail> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new Error('您不是该 Draft 的成员');
    }

    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new Error('Draft 不存在');
    }

    const members = await this.draftRepo.findMembers(draftId);
    return { draft, members };
  }

  /**
   * 更新 Draft 状态
   */
  async updateStatus(draftId: number, userId: number, input: UpdateDraftStatusInput): Promise<SelectDraft> {
    const validStatuses = ['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived'];
    if (!validStatuses.includes(input.status)) {
      throw new Error('无效的状态值');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new Error('您不是该 Draft 的成员');
    }

    return this.draftRepo.updateStatus(draftId, input.status);
  }

  /**
   * 删除 Draft
   */
  async delete(draftId: number, userId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new Error('只有 Draft owner 可以删除 Draft');
    }

    await this.draftRepo.delete(draftId);
  }

  /**
   * 检查用户是否是 Draft 成员
   */
  async isMember(draftId: number, userId: number): Promise<boolean> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    return !!membership;
  }

  /**
   * 检查用户是否是 Draft owner
   */
  async isOwner(draftId: number, userId: number): Promise<boolean> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    return membership?.role === 'owner';
  }

  /**
   * 创建消息
   */
  async createMessage(draftId: number, userId: number, input: CreateMessageInput): Promise<DraftMessageWithUser> {
    if (!input.content) {
      throw new Error('参数无效');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new Error('您不是该 Draft 的成员');
    }

    const message = await this.draftRepo.createMessage({
      draftId,
      parentId: input.parentId || null,
      userId,
      content: input.content,
      messageType: input.messageType || 'text',
      metadata: input.metadata || null,
    });

    // 更新 Draft updatedAt
    await this.draftRepo.touch(draftId);

    // 获取带用户名的消息
    const user = await this.userRepo.findById(userId);
    return {
      ...message,
      userName: user?.name || 'Unknown',
    };
  }

  /**
   * 获取消息列表
   */
  async findMessages(
    draftId: number,
    userId: number,
    options: {
      parentId?: number | null;
      before?: string;
      limit?: number;
    } = {}
  ): Promise<DraftMessageWithUser[]> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new Error('您不是该 Draft 的成员');
    }

    return this.draftRepo.findMessages(draftId, options);
  }

  /**
   * 确认消息
   */
  async confirmMessage(
    draftId: number,
    messageId: number,
    userId: number,
    input: ConfirmMessageInput
  ): Promise<{ userId: number; userName: string; type: string }> {
    const validTypes = ['agree', 'disagree', 'suggest'];
    if (!validTypes.includes(input.type)) {
      throw new Error('type 必须是 agree, disagree 或 suggest');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new Error('您不是该 Draft 的成员');
    }

    const message = await this.draftRepo.findMessage(messageId, draftId);
    if (!message) {
      throw new Error('消息不存在');
    }

    await this.draftRepo.upsertConfirmation({
      messageId,
      userId,
      type: input.type,
      comment: input.comment || null,
    });

    const user = await this.userRepo.findById(userId);
    return {
      userId,
      userName: user?.name || 'Unknown',
      type: input.type,
    };
  }

  /**
   * 获取消息确认列表
   */
  async findConfirmations(draftId: number, messageId: number, userId: number): Promise<Array<{ userId: number; userName: string; type: string; comment: string | null; createdAt: string }>> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new Error('您不是该 Draft 的成员');
    }

    const confirmations = await this.draftRepo.findConfirmations(messageId);
    return confirmations.map(c => ({
      userId: c.userId,
      userName: c.userName,
      type: c.type,
      comment: c.comment,
      createdAt: c.createdAt,
    }));
  }

  /**
   * 添加成员
   */
  async addMember(draftId: number, userId: number, newUserId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new Error('只有 Draft owner 可以添加成员');
    }

    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new Error('Draft 不存在');
    }

    // 验证新成员是否为组织成员
    const project = await this.projectRepo.findById(draft.projectId);
    if (!project || !project.organizationId) {
      throw new Error('项目不存在');
    }

    const isOrgMember = await this.orgRepo.findUserMembership(project.organizationId, newUserId);
    if (!isOrgMember) {
      throw new Error('用户不是项目所属组织的成员');
    }

    await this.draftRepo.addMember({
      draftId,
      userId: newUserId,
      role: 'participant',
    });
  }

  /**
   * 移除成员
   */
  async removeMember(draftId: number, userId: number, memberId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new Error('只有 Draft owner 可以移除成员');
    }

    const targetMembership = await this.draftRepo.findMember(draftId, memberId);
    if (!targetMembership) {
      throw new Error('成员不存在');
    }

    if (targetMembership.role === 'owner') {
      throw new Error('无法移除 Draft owner');
    }

    await this.draftRepo.removeMember(draftId, memberId);
  }

  /**
   * 获取 Draft 所属项目 ID
   */
  async getProjectId(draftId: number): Promise<number | null> {
    const draft = await this.draftRepo.findById(draftId);
    return draft?.projectId || null;
  }
}
```

- [ ] **Step 2: 更新 Services 导出**

```typescript
// packages/server/src/services/index.ts
export { AuthService } from './auth.service.js';
export type { RegisterInput, LoginInput, AuthResult } from './auth.service.js';

export { OrganizationService } from './organization.service.js';
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  OrganizationDetail,
} from './organization.service.js';

export { ProjectService } from './project.service.js';
export type {
  CreateProjectInput,
  AddRepoInput,
  ImportRepoInput,
} from './project.service.js';

export { DraftService } from './draft.service.js';
export type {
  CreateDraftInput,
  CreateMessageInput,
  UpdateDraftStatusInput,
  ConfirmMessageInput,
  DraftDetail,
} from './draft.service.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 3: 重构 Drafts Routes

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`

由于 Drafts 路由涉及 WebSocket 广播和 AI 命令处理，保留这些逻辑但重构数据访问部分。

- [ ] **Step 1: 重构 Drafts Routes**

保持 WebSocket 和 AI 命令处理逻辑，使用 DraftService 替代原生 SQL。

```typescript
// packages/server/src/routes/drafts.ts
import { Router } from 'express';
import { DraftService } from '../services/draft.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { getWebSocketServer } from '../websocket/server.js';
import {
  createDraftMessageEvent,
  createDraftStatusChangedEvent,
  createDraftMessageConfirmedEvent,
  createDraftAIResponseEvent,
} from '../websocket/types.js';
import { createLogger } from '../logger/index.js';
import {
  isAICommand,
  parseAICommand,
  executeAICommand,
} from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';
import { getDb } from '../db/index.js';

const logger = createLogger('drafts');

export function createDraftsRouter(): Router {
  const router = Router();
  const draftService = new DraftService();

  // POST /api/drafts - 创建 Draft
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const draft = await draftService.create(userId, req.body);
      res.status(201).json({ draft });
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('缺少') || error.message.includes('标题')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('创建 Draft 失败', error);
        res.status(500).json({ error: '创建 Draft 失败' });
      }
    }
  });

  // GET /api/drafts - 获取用户参与的所有 Draft
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const drafts = await draftService.findByUserId(userId);
      res.json(drafts);
    } catch (error: any) {
      logger.error('获取 Draft 列表失败', error);
      res.status(500).json({ error: '获取 Draft 列表失败' });
    }
  });

  // GET /api/drafts/:draftId - 获取 Draft 详情
  router.get('/:draftId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      const result = await draftService.findById(draftId, userId);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取 Draft 详情失败', error);
        res.status(500).json({ error: '获取 Draft 详情失败' });
      }
    }
  });

  // POST /api/drafts/:draftId/messages - 发送消息
  router.post('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { content, messageType, parentId, metadata } = req.body;

    if (isNaN(draftId) || !content) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // Check if content is an AI command
      const isAI = isAICommand(content);
      const actualMessageType = isAI ? 'ai_command' : (messageType || 'text');

      const message = await draftService.createMessage(draftId, userId, {
        content,
        messageType: actualMessageType,
        parentId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageEvent(draftId, message);
        wsServer.broadcastDraftMessage(draftId, wsMessage, userId);
      }

      // If it's an AI command, execute it and save the response
      if (isAI && isAIEnabled()) {
        const command = parseAICommand(content);
        if (command) {
          executeAICommand(getDb(), draftId, command, userId)
            .then(async (aiResult) => {
              const aiResponseContent = aiResult.success
                ? aiResult.response
                : `AI 命令执行失败: ${aiResult.error}`;

              const aiMessage = await draftService.createMessage(draftId, 0, {
                content: aiResponseContent || '',
                messageType: aiResult.success ? 'ai_response' : 'ai_error',
                parentId: message.id,
                metadata: JSON.stringify({ commandType: command.type }),
              });

              // Broadcast AI response
              if (wsServer) {
                const aiWsMessage = createDraftAIResponseEvent(draftId, {
                  ...aiMessage,
                  userName: 'AI Assistant',
                }, command.type);
                wsServer.broadcastDraftMessage(draftId, aiWsMessage);
              }

              logger.info('AI command executed', {
                draftId,
                messageId: message.id,
                aiMessageId: aiMessage.id,
                success: aiResult.success,
                commandType: command.type,
              });
            })
            .catch((error) => {
              logger.error('Failed to execute AI command', { draftId, messageId: message.id, error });
            });
        }
      }

      res.status(201).json({ message });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('参数')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('发送消息失败', error);
        res.status(500).json({ error: '发送消息失败' });
      }
    }
  });

  // GET /api/drafts/:draftId/messages - 获取消息列表
  router.get('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const before = req.query.before as string | undefined;

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      // Handle 'null' as string for parentId
      const actualParentId = parentId !== undefined
        ? (req.query.parentId === 'null' ? null : parentId)
        : undefined;

      const messages = await draftService.findMessages(draftId, userId, {
        parentId: actualParentId,
        before,
        limit,
      });
      res.json(messages);
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('获取消息列表失败', error);
        res.status(500).json({ error: '获取消息列表失败' });
      }
    }
  });

  // PUT /api/drafts/:draftId/status - 更新 Draft 状态
  router.put('/:draftId/status', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { status } = req.body;

    if (isNaN(draftId) || !status) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const draft = await draftService.updateStatus(draftId, userId, { status });

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftStatusChangedEvent(draftId, status);
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ draft });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('无效')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('更新 Draft 状态失败', error);
        res.status(500).json({ error: '更新 Draft 状态失败' });
      }
    }
  });

  // POST /api/drafts/:draftId/messages/:messageId/confirm - 确认消息
  router.post('/:draftId/messages/:messageId/confirm', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const { type, comment } = req.body;

    if (isNaN(draftId) || isNaN(messageId) || !type) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const result = await draftService.confirmMessage(draftId, messageId, userId, {
        type,
        comment,
      });

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageConfirmedEvent(
          draftId,
          messageId,
          result.userId,
          result.userName,
          result.type
        );
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('type')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('确认消息失败', error);
        res.status(500).json({ error: '确认消息失败' });
      }
    }
  });

  // GET /api/drafts/:draftId/messages/:messageId/confirmations - 获取消息确认列表
  router.get('/:draftId/messages/:messageId/confirmations', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(draftId) || isNaN(messageId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const confirmations = await draftService.findConfirmations(draftId, messageId, userId);
      res.json({ confirmations });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('获取确认列表失败', error);
        res.status(500).json({ error: '获取确认列表失败' });
      }
    }
  });

  // POST /api/drafts/:draftId/members - 添加成员
  router.post('/:draftId/members', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { newUserId } = req.body;

    if (isNaN(draftId) || !newUserId) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      await draftService.addMember(draftId, userId, newUserId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('owner') || error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('参数')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('添加成员失败', error);
        res.status(500).json({ error: '添加成员失败' });
      }
    }
  });

  // DELETE /api/drafts/:draftId/members/:memberId - 移除成员
  router.delete('/:draftId/members/:memberId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const memberId = parseInt(req.params.memberId, 10);

    if (isNaN(draftId) || isNaN(memberId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      await draftService.removeMember(draftId, userId, memberId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('owner') || error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('参数')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在') || error.message.includes('无法')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('移除成员失败', error);
        res.status(500).json({ error: '移除成员失败' });
      }
    }
  });

  // DELETE /api/drafts/:draftId - 删除 Draft
  router.delete('/:draftId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      await draftService.delete(draftId, userId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('删除 Draft 失败', error);
        res.status(500).json({ error: '删除 Draft 失败' });
      }
    }
  });

  return router;
}
```

---

### Task 4: 更新主入口文件

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 更新路由注册**

```typescript
// 修改前
app.use('/api/drafts', createDraftsRouter(db));

// 修改后
app.use('/api/drafts', createDraftsRouter());
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 5: 验证功能

**Files:**
- Modify: 无需修改文件

- [ ] **Step 1: 运行现有测试**

```bash
cd packages/server && npm test
```

Expected: 测试通过或无测试文件

- [ ] **Step 2: 启动服务器验证**

```bash
cd packages/server && npm run dev
```

Expected: 服务器启动成功，无错误

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/repositories/draft.repository.ts packages/server/src/services/draft.service.ts packages/server/src/routes/drafts.ts packages/server/src/index.ts packages/server/src/repositories/index.ts packages/server/src/services/index.ts
git commit -m "$(cat <<'EOF'
feat(server): refactor draft module with Drizzle ORM

- Add DraftRepository for data access
- Add DraftService for business logic
- Refactor drafts routes to use service layer
- Keep WebSocket and AI command handling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成标准

1. DraftRepository 已创建并通过编译
2. DraftService 已创建并通过编译
3. Drafts Routes 已重构
4. WebSocket 和 AI 命令处理保留正常
5. 服务器能正常启动
6. 提交已创建

## 后续阶段

完成此阶段后，进入 Phase 6: 其他模块重构（Build、Token、Claude Config 等）。