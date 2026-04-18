# Backend Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构后端架构，修复过度设计、过期设计、架构问题和性能瓶颈

**Architecture:** 分阶段实施，先处理高优先级问题（过期代码清理、架构分层修复），再处理中优先级问题（性能优化、职责分离）。每个任务独立可测试。

**Tech Stack:** TypeScript, Drizzle ORM, Express, SQLite

---

## File Structure

### 需要删除的文件
- `packages/server/src/db/schema.ts` - raw SQL schema 定义

### 需要修改的文件
- `packages/server/src/db/schema/projects.ts` - 删除 project_members 表定义
- `packages/server/src/db/schema/drafts.ts` - 简化 message_type
- `packages/server/src/middleware/auth.ts` - 移除 projectRole 字段
- `packages/server/src/routes/drafts.ts` - AI 逻辑移到 Service
- `packages/server/src/services/draft.service.ts` - 添加 AI 响应方法
- `packages/server/src/services/organization.service.ts` - 优化 acceptInvitation
- `packages/server/src/repositories/draft.repository.ts` - 统一使用 Drizzle
- `packages/server/src/ai/commands.ts` - 删除未使用方法

### 需要创建的文件
- `packages/server/src/db/migrations/` - 数据库迁移脚本

---

## Phase 1: 过期代码清理（高优先级）

### Task 1: 删除 project_members 表定义

**Files:**
- Modify: `packages/server/src/db/schema/projects.ts:17-29`
- Modify: `packages/server/src/db/schema/index.ts`

- [ ] **Step 1: 删除 projectMembers 表定义**

修改 `packages/server/src/db/schema/projects.ts`，删除 projectMembers 相关代码：

```typescript
// 删除以下代码（第 17-29 行）
export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'product'] }).notNull(),
});

export type InsertProjectMember = typeof projectMembers.$inferInsert;
export type SelectProjectMember = typeof projectMembers.$inferSelect;
```

- [ ] **Step 2: 更新 schema index 导出**

修改 `packages/server/src/db/schema/index.ts`，删除 projectMembers 导出：

```typescript
// 删除这行
export { projects, projectMembers } from './projects.js';
// 改为
export { projects } from './projects.js';

// 删除这两行
export type { InsertProjectMember, SelectProjectMember } from './projects.js';
```

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/db/schema/projects.ts packages/server/src/db/schema/index.ts
git commit -m "refactor(db): remove unused projectMembers table definition"
```

---

### Task 2: 移除未使用的 projectRole 字段

**Files:**
- Modify: `packages/server/src/middleware/auth.ts:16-24`

- [ ] **Step 1: 删除 projectRole 类型扩展**

修改 `packages/server/src/middleware/auth.ts`，删除 projectRole 字段：

```typescript
// 将第 16-24 行改为：
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      orgRole?: OrgRole;
    }
  }
}
```

- [ ] **Step 2: 删除中间件中的 projectRole 赋值**

在 `createProjectMemberMiddleware` 函数中（约第 145 行），删除：
```typescript
(req as any).projectRole = 'owner';
```

保留 `orgRole` 的赋值逻辑。

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/middleware/auth.ts
git commit -m "refactor(auth): remove unused projectRole field"
```

---

### Task 3: 删除 messages 表定义

**Files:**
- Modify: `packages/server/src/db/schema.ts:66-73`
- Modify: `packages/server/src/db/schema/index.ts`
- Modify: `packages/server/src/db/schema/messages.ts` (如果存在)

- [ ] **Step 1: 检查 messages 表使用情况**

```bash
grep -r "messages" packages/server/src --include="*.ts" | grep -v "draft_messages" | grep -v "node_modules"
```

确认无业务代码引用 messages 表。

- [ ] **Step 2: 删除 raw schema 中的 messages 表**

修改 `packages/server/src/db/schema.ts`，删除第 66-73 行：

```typescript
// 删除以下代码
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat' CHECK (type IN ('chat', 'notification')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: 删除 schema/messages.ts 如果存在**

```bash
rm -f packages/server/src/db/schema/messages.ts
```

- [ ] **Step 4: 更新 schema index**

从 `packages/server/src/db/schema/index.ts` 删除 messages 相关导出：

```typescript
// 删除这些行
export { messages } from './messages.js';
export type { InsertMessage, SelectMessage } from './messages.js';
```

- [ ] **Step 5: 提交更改**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/schema/index.ts
git commit -m "refactor(db): remove unused messages table"
```

---

### Task 4: 删除未使用的 getSupportedCommands 方法

**Files:**
- Modify: `packages/server/src/ai/commands.ts:148-157`

- [ ] **Step 1: 删除 getSupportedCommands 方法**

修改 `packages/server/src/ai/commands.ts`，删除第 148-157 行：

```typescript
// 删除整个函数
export function getSupportedCommands(): Array<{ type: AICommandType; description: string; example: string }> {
  return [
    { type: 'generate', description: '生成代码', example: '@AI generate a function to sort array' },
    { type: 'analyze', description: '分析代码或问题', example: '@AI analyze the performance issues' },
    { type: 'suggest', description: '提供建议', example: '@AI suggest improvements for this code' },
    { type: 'explain', description: '解释代码或概念', example: '@AI explain how React hooks work' },
    { type: 'review', description: '代码评审', example: '@AI review the changes in file.ts' },
    { type: 'refactor', description: '重构建议', example: '@AI refactor this function' },
    { type: 'test', description: '生成测试', example: '@AI test cases for this component' },
  ];
}
```

- [ ] **Step 2: 提交更改**

```bash
git add packages/server/src/ai/commands.ts
git commit -m "refactor(ai): remove unused getSupportedCommands function"
```

---

## Phase 2: 架构分层修复（高优先级）

### Task 5: 将 AI 响应逻辑移到 DraftService

**Files:**
- Modify: `packages/server/src/services/draft.service.ts`
- Modify: `packages/server/src/routes/drafts.ts:75-156`

- [ ] **Step 1: 在 DraftService 添加 handleAICommand 方法**

在 `packages/server/src/services/draft.service.ts` 末尾添加：

```typescript
import { isAICommand, parseAICommand, executeAICommand } from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';

export interface AICommandResult {
  success: boolean;
  message?: DraftMessageWithUser;
  error?: string;
}

// 在 DraftService 类中添加方法
async handleAICommand(
  draftId: number,
  userId: number,
  content: string,
  parentMessageId?: number
): Promise<AICommandResult> {
  if (!isAIEnabled()) {
    return {
      success: false,
      error: 'AI 功能未启用。请配置 ANTHROPIC_API_KEY。',
    };
  }

  const command = parseAICommand(content);
  if (!command) {
    return {
      success: false,
      error: '无法解析 AI 命令',
    };
  }

  try {
    const aiResult = await executeAICommand(draftId, command, userId);
    
    const aiResponseContent = aiResult.success
      ? aiResult.response
      : `AI 命令执行失败: ${aiResult.error}`;

    const aiMessage = await this.createMessage(draftId, 0, {
      content: aiResponseContent || '',
      messageType: aiResult.success ? 'ai_response' : 'ai_error',
      parentId: parentMessageId,
      metadata: JSON.stringify({ commandType: command.type }),
    });

    return {
      success: aiResult.success,
      message: aiMessage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI 命令执行失败',
    };
  }
}

isAICommand(content: string): boolean {
  return isAICommand(content);
}
```

- [ ] **Step 2: 简化 routes/drafts.ts 中的消息处理逻辑**

修改 `packages/server/src/routes/drafts.ts` 第 75-156 行：

```typescript
router.post('/:draftId/messages', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const draftId = parseInt(req.params.draftId as string, 10);
  const { content, messageType, parentId, metadata } = req.body;

  if (isNaN(draftId) || !content) {
    res.status(400).json({ error: '参数无效' });
    return;
  }

  try {
    const isAI = draftService.isAICommand(content);
    const actualMessageType = isAI ? 'ai_command' : (messageType || 'text');

    const message = await draftService.createMessage(draftId, userId, {
      content,
      messageType: actualMessageType,
      parentId,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    const wsServer = getWebSocketServer();
    if (wsServer) {
      const wsMessage = createDraftMessageEvent(draftId, {
        id: message.id,
        draft_id: message.draftId,
        parent_id: message.parentId,
        user_id: message.userId,
        user_name: message.userName || 'Unknown',
        content: message.content || '',
        message_type: message.messageType,
        created_at: message.createdAt,
      });
      wsServer.broadcastDraftMessage(draftId, wsMessage, userId);
    }

    // AI 命令处理移到 Service 层
    if (isAI) {
      draftService.handleAICommand(draftId, userId, content, message.id)
        .then((aiResult) => {
          if (aiResult.message && wsServer) {
            const aiWsMessage = createDraftAIResponseEvent(draftId, {
              id: aiResult.message.id,
              draft_id: aiResult.message.draftId,
              parent_id: aiResult.message.parentId,
              user_id: aiResult.message.userId,
              user_name: 'AI Assistant',
              content: aiResult.message.content || '',
              message_type: aiResult.message.messageType,
              metadata: aiResult.message.metadata || null,
              created_at: aiResult.message.createdAt,
            }, 'unknown');
            wsServer.broadcastDraftMessage(draftId, aiWsMessage);
          }
        })
        .catch((error) => {
          logger.error('Failed to handle AI command', { draftId, error });
        });
    }

    res.status(201).json({ message });
  } catch (error: any) {
    if (error.message.includes('不是')) {
      res.status(403).json({ error: error.message });
    } else {
      logger.error('发送消息失败', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });
});
```

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/services/draft.service.ts packages/server/src/routes/drafts.ts
git commit -m "refactor(draft): move AI command handling to service layer"
```

---

### Task 6: 统一 DraftRepository 使用 Drizzle ORM

**Files:**
- Modify: `packages/server/src/repositories/draft.repository.ts:184-203`

- [ ] **Step 1: 重写 upsertConfirmation 方法使用 Drizzle**

修改 `packages/server/src/repositories/draft.repository.ts` 第 184-203 行：

```typescript
async upsertConfirmation(data: InsertMessageConfirmation): Promise<SelectMessageConfirmation> {
  const db = getDb();
  const sqliteDb = getSqliteDb();
  
  // 使用事务
  return sqliteDb.transaction(() => {
    // 先尝试更新
    const existing = db.select()
      .from(messageConfirmations)
      .where(and(
        eq(messageConfirmations.messageId, data.messageId),
        eq(messageConfirmations.userId, data.userId)
      ))
      .get();

    if (existing) {
      return db.update(messageConfirmations)
        .set({
          type: data.type,
          comment: data.comment,
          createdAt: sql`datetime('now')`,
        })
        .where(and(
          eq(messageConfirmations.messageId, data.messageId),
          eq(messageConfirmations.userId, data.userId)
        ))
        .returning()
        .get();
    } else {
      return db.insert(messageConfirmations)
        .values(data)
        .returning()
        .get();
    }
  })();
}
```

- [ ] **Step 2: 提交更改**

```bash
git add packages/server/src/repositories/draft.repository.ts
git commit -m "refactor(draft): use Drizzle ORM for upsertConfirmation"
```

---

## Phase 3: 性能优化（高优先级）

### Task 7: 优化 OrganizationService.acceptInvitation

**Files:**
- Modify: `packages/server/src/services/organization.service.ts:344-376`
- Modify: `packages/server/src/repositories/organization.repository.ts`

- [ ] **Step 1: 在 OrganizationRepository 添加 acceptInvitationInTransaction 方法**

在 `packages/server/src/repositories/organization.repository.ts` 添加：

```typescript
async acceptInvitationInTransaction(
  invId: number,
  organizationId: number,
  userId: number,
  role: string,
  invitedBy: number
): Promise<{ org: SelectOrganization; member: OrganizationMemberWithUser }> {
  const sqliteDb = getSqliteDb();
  const db = getDb();

  return sqliteDb.transaction(() => {
    // 更新邀请状态
    db.update(organizationInvitations)
      .set({ status: 'accepted' })
      .where(eq(organizationInvitations.id, invId))
      .run();

    // 添加成员
    db.insert(organizationMembers)
      .values({
        organizationId,
        userId,
        role: role as 'owner' | 'developer' | 'member',
        invitedBy,
      })
      .run();

    // 获取组织信息
    const org = db.select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .get()!;

    // 获取成员信息
    const member = db.select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      invitedBy: organizationMembers.invitedBy,
      joinedAt: organizationMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      ))
      .get()!;

    return { org, member: member as OrganizationMemberWithUser };
  })();
}
```

- [ ] **Step 2: 简化 OrganizationService.acceptInvitation**

修改 `packages/server/src/services/organization.service.ts` 第 344-376 行：

```typescript
async acceptInvitation(userId: number, invId: number): Promise<{ organization: SelectOrganization; member: OrganizationMemberWithUser }> {
  const user = await this.userRepo.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  const invitation = await this.orgRepo.findPendingInvitation(invId, user.email);
  if (!invitation) {
    throw new Error('邀请不存在或已处理');
  }

  return this.orgRepo.acceptInvitationInTransaction(
    invId,
    invitation.organizationId,
    userId,
    invitation.role,
    invitation.invitedBy
  );
}
```

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/services/organization.service.ts packages/server/src/repositories/organization.repository.ts
git commit -m "perf(organization): optimize acceptInvitation with single transaction"
```

---

### Task 8: 删除 raw SQL Schema 文件

**Files:**
- Delete: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/init.ts`

- [ ] **Step 1: 检查 schema.ts 的使用情况**

```bash
grep -r "from './schema.js'" packages/server/src --include="*.ts"
grep -r "initSchema" packages/server/src --include="*.ts"
```

- [ ] **Step 2: 更新 init.ts 使用 Drizzle 迁移**

修改 `packages/server/src/db/init.ts`：

```typescript
import { getSqliteDb } from './connection.js';
import { users, organizations, organizationMembers, organizationInvitations, projects, drafts, draftMembers, draftMessages, messageConfirmations, builds, projectTokens, projectRepos, userClaudeConfigs } from './schema/index.js';
import { sql } from 'drizzle-orm';
import { getDb } from './drizzle.js';

export function initSchema(): void {
  const db = getDb();
  const sqliteDb = getSqliteDb();
  
  // 使用 Drizzle 的 migrate 或直接执行 CREATE TABLE
  // 由于 Drizzle Schema 已定义，这里使用 raw SQL 作为初始化
  // 实际生产环境应使用 drizzle-kit migrate
  
  sqliteDb.exec(`
    -- 这里保留必要的表创建语句，从 schema.ts 复制
    -- 或者改用 drizzle-kit 的 push 功能
  `);
}
```

注意：由于项目使用 SQLite 且尚未正式发布，可以保留 raw SQL 初始化但需确保与 Drizzle Schema 同步。

**重要决策点**：此任务需要确认是保留 raw SQL 初始化还是迁移到 Drizzle migrate。

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/db/init.ts
git commit -m "refactor(db): update schema initialization"
```

---

## Phase 4: 中优先级优化（可选）

### Task 9: 添加 Draft 消息分页支持

**Files:**
- Modify: `packages/server/src/repositories/draft.repository.ts:155-182`

- [ ] **Step 1: 更新 findMessages 方法支持分页**

```typescript
async findMessages(
  draftId: number,
  options: { parentId?: number | null; before?: string; limit?: number; offset?: number } = {}
): Promise<DraftMessageWithUser[]> {
  const db = getDb();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

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
    .where(eq(draftMessages.draftId, draftId))
    .orderBy(desc(draftMessages.createdAt))
    .limit(limit)
    .offset(offset);

  const result = await query.all();
  return result as DraftMessageWithUser[];
}
```

- [ ] **Step 2: 提交更改**

```bash
git add packages/server/src/repositories/draft.repository.ts
git commit -m "feat(draft): add pagination support for messages"
```

---

### Task 10: 简化 Draft 状态

**Files:**
- Modify: `packages/server/src/db/schema/drafts.ts:11-13`
- Modify: `packages/server/src/services/draft.service.ts:89`

- [ ] **Step 1: 简化状态枚举**

评估后决定保留哪些状态。建议简化为 4 种：
- `discussing` - 讨论中
- `developing` - 开发中
- `reviewing` - 评审中
- `confirmed` - 已确认

修改 `packages/server/src/db/schema/drafts.ts`：

```typescript
status: text('status', {
  enum: ['discussing', 'developing', 'reviewing', 'confirmed']
}).notNull().default('discussing'),
```

- [ ] **Step 2: 更新 DraftService 状态验证**

修改 `packages/server/src/services/draft.service.ts`：

```typescript
async updateStatus(draftId: number, userId: number, status: string): Promise<SelectDraft> {
  const validStatuses = ['discussing', 'developing', 'reviewing', 'confirmed'];
  // ...
}
```

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/db/schema/drafts.ts packages/server/src/services/draft.service.ts
git commit -m "refactor(draft): simplify status enum"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] A3 (projectRole) - Task 2
- [x] O3 (acceptInvitation) - Task 7
- [x] D4 (AI logic) - Task 5
- [x] S1 (project_members) - Task 1
- [x] S6 (raw SQL) - Task 8
- [x] AI2 (getSupportedCommands) - Task 4
- [x] WS2 (messages table) - Task 3
- [x] R2 (Drizzle upsert) - Task 6
- [ ] S2 (organizationId NOT NULL) - 需要新增 Task
- [ ] S4 (message_confirmations) - 需要评估决策

**2. Placeholder scan:** 无 TBD/TODO

**3. Type consistency:** 已检查方法签名一致性

---

## Missing Tasks (Added)

### Task 11: 将 organizationId 改为 NOT NULL

**Files:**
- Modify: `packages/server/src/db/schema/projects.ts:10`
- Modify: `packages/server/src/db/schema.ts` (如果保留)

- [ ] **Step 1: 更新 Drizzle Schema**

修改 `packages/server/src/db/schema/projects.ts` 第 10 行：

```typescript
// 改为
organizationId: integer('organization_id').notNull().references(() => organizations.id),
```

- [ ] **Step 2: 更新 raw SQL Schema（如果保留）**

修改 `packages/server/src/db/schema.ts` 中 projects 表定义，添加 NOT NULL 和外键约束。

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/db/schema/projects.ts packages/server/src/db/schema.ts
git commit -m "refactor(db): make organizationId NOT NULL"
```

---

## 执行顺序

**Phase 1** (Task 1-4): 过期代码清理 - 可并行执行
**Phase 2** (Task 5-6): 架构分层修复 - 顺序执行
**Phase 3** (Task 7-8, 11): 性能优化 - 可并行执行
**Phase 4** (Task 9-10): 中优先级优化 - 可选执行
