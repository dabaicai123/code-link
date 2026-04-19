# 多人协作模块实现计划（Phase 2: WebSocket 实时消息推送）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现协作模块的实时消息推送，支持 Draft 内的消息实时同步和用户在线状态。

**Architecture:** 扩展现有 WebSocket 服务器，添加 Draft 频道管理；前端使用原生 WebSocket API 建立连接，实现消息实时推送。

**Tech Stack:** ws (后端), 原生 WebSocket API (前端), TypeScript

---

## 文件结构

```
packages/server/
├── src/
│   ├── websocket/
│   │   ├── channels.ts        # 修改：扩展支持 Draft 频道
│   │   ├── types.ts           # 修改：添加 Draft 消息类型
│   │   └── server.ts          # 修改：添加 Draft 消息处理
│   └── routes/
│       └── drafts.ts          # 修改：集成 WebSocket 广播
└── tests/
    └── websocket-draft.test.ts # 新增：Draft WebSocket 测试

packages/web/
└── src/
    ├── lib/
    │   └── draft-websocket.ts  # 新增：Draft WebSocket Hook
    └── components/
        └── collaboration/
            └── online-users.tsx # 新增：在线用户显示组件
```

---

## Task 1: 扩展 WebSocket 类型定义

**Files:**
- Modify: `packages/server/src/websocket/types.ts`

- [ ] **Step 1: 添加 Draft 相关消息类型**

在 `packages/server/src/websocket/types.ts` 文件末尾添加：

```typescript
// ==================== Draft 相关消息类型 ====================

export type DraftMessageType =
  | 'draft_message'
  | 'draft_member_joined'
  | 'draft_member_left'
  | 'draft_status_changed'
  | 'draft_message_confirmed';

export interface DraftBaseMessage {
  type: DraftMessageType;
  draftId: number;
  timestamp: string;
}

export interface DraftMessageEvent extends DraftBaseMessage {
  type: 'draft_message';
  message: {
    id: number;
    draft_id: number;
    parent_id: number | null;
    user_id: number;
    user_name: string;
    content: string;
    message_type: string;
    created_at: string;
  };
}

export interface DraftMemberJoinedEvent extends DraftBaseMessage {
  type: 'draft_member_joined';
  userId: number;
  userName: string;
  memberCount: number;
}

export interface DraftMemberLeftEvent extends DraftBaseMessage {
  type: 'draft_member_left';
  userId: number;
  userName: string;
  memberCount: number;
}

export interface DraftStatusChangedEvent extends DraftBaseMessage {
  type: 'draft_status_changed';
  status: string;
}

export interface DraftMessageConfirmedEvent extends DraftBaseMessage {
  type: 'draft_message_confirmed';
  messageId: number;
  userId: number;
  userName: string;
  confirmationType: string;
}

export type DraftMessage =
  | DraftMessageEvent
  | DraftMemberJoinedEvent
  | DraftMemberLeftEvent
  | DraftStatusChangedEvent
  | DraftMessageConfirmedEvent;

// 消息创建函数
export function createDraftMessageEvent(
  draftId: number,
  message: DraftMessageEvent['message']
): DraftMessageEvent {
  return {
    type: 'draft_message',
    draftId,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftMemberJoinedEvent(
  draftId: number,
  userId: number,
  userName: string,
  memberCount: number
): DraftMemberJoinedEvent {
  return {
    type: 'draft_member_joined',
    draftId,
    userId,
    userName,
    memberCount,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftMemberLeftEvent(
  draftId: number,
  userId: number,
  userName: string,
  memberCount: number
): DraftMemberLeftEvent {
  return {
    type: 'draft_member_left',
    draftId,
    userId,
    userName,
    memberCount,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftStatusChangedEvent(
  draftId: number,
  status: string
): DraftStatusChangedEvent {
  return {
    type: 'draft_status_changed',
    draftId,
    status,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftMessageConfirmedEvent(
  draftId: number,
  messageId: number,
  userId: number,
  userName: string,
  confirmationType: string
): DraftMessageConfirmedEvent {
  return {
    type: 'draft_message_confirmed',
    draftId,
    messageId,
    userId,
    userName,
    confirmationType,
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/websocket/types.ts
git commit -m "$(cat <<'EOF'
feat(server): add Draft WebSocket message types

Add types for draft_message, draft_member_joined/left,
draft_status_changed, and draft_message_confirmed events.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 扩展 ChannelManager 支持 Draft 频道

**Files:**
- Modify: `packages/server/src/websocket/channels.ts`

- [ ] **Step 1: 添加 Draft 频道管理方法**

在 `packages/server/src/websocket/channels.ts` 中，修改 `ChannelManager` 类：

```typescript
// src/websocket/channels.ts
import WebSocket from 'ws';

interface ClientInfo {
  userId: number;
  userName: string;
  projectId: number;
}

// 新增：Draft 客户端信息
interface DraftClientInfo {
  userId: number;
  userName: string;
  draftId: number;
}

export class ChannelManager {
  // projectId -> Set<WebSocket>
  private channels: Map<number, Set<WebSocket>> = new Map();

  // WebSocket -> ClientInfo
  private clientInfo: Map<WebSocket, ClientInfo> = new Map();

  // 新增：draftId -> Set<WebSocket>
  private draftChannels: Map<number, Set<WebSocket>> = new Map();

  // 新增：WebSocket -> DraftClientInfo
  private draftClientInfo: Map<WebSocket, DraftClientInfo> = new Map();

  // ==================== 原有 Project 频道方法 ====================

  subscribe(ws: WebSocket, projectId: number, userId: number, userName: string): void {
    if (!this.channels.has(projectId)) {
      this.channels.set(projectId, new Set());
    }
    this.channels.get(projectId)!.add(ws);
    this.clientInfo.set(ws, { userId, userName, projectId });
  }

  unsubscribe(ws: WebSocket, projectId: number): void {
    const channel = this.channels.get(projectId);
    if (channel) {
      channel.delete(ws);
      if (channel.size === 0) {
        this.channels.delete(projectId);
      }
    }
    this.clientInfo.delete(ws);
  }

  getChannelClients(projectId: number): Set<WebSocket> {
    return this.channels.get(projectId) || new Set();
  }

  getClientInfo(ws: WebSocket): ClientInfo | undefined {
    return this.clientInfo.get(ws);
  }

  broadcast(projectId: number, message: string, excludeSender?: WebSocket): void {
    const clients = this.channels.get(projectId);
    if (!clients) return;

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN && client !== excludeSender) {
        client.send(message);
      }
    }
  }

  getChannelUserCount(projectId: number): number {
    return this.channels.get(projectId)?.size || 0;
  }

  // ==================== 新增 Draft 频道方法 ====================

  /**
   * 订阅 Draft 频道
   */
  subscribeToDraft(ws: WebSocket, draftId: number, userId: number, userName: string): void {
    if (!this.draftChannels.has(draftId)) {
      this.draftChannels.set(draftId, new Set());
    }
    this.draftChannels.get(draftId)!.add(ws);
    this.draftClientInfo.set(ws, { userId, userName, draftId });
  }

  /**
   * 取消订阅 Draft 频道
   */
  unsubscribeFromDraft(ws: WebSocket, draftId: number): void {
    const channel = this.draftChannels.get(draftId);
    if (channel) {
      channel.delete(ws);
      if (channel.size === 0) {
        this.draftChannels.delete(draftId);
      }
    }
    this.draftClientInfo.delete(ws);
  }

  /**
   * 获取 Draft 频道的所有客户端
   */
  getDraftChannelClients(draftId: number): Set<WebSocket> {
    return this.draftChannels.get(draftId) || new Set();
  }

  /**
   * 获取 WebSocket 的 Draft 客户端信息
   */
  getDraftClientInfo(ws: WebSocket): DraftClientInfo | undefined {
    return this.draftClientInfo.get(ws);
  }

  /**
   * 广播消息到 Draft 频道
   */
  broadcastToDraft(draftId: number, message: string, excludeSender?: WebSocket): void {
    const clients = this.draftChannels.get(draftId);
    if (!clients) return;

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN && client !== excludeSender) {
        client.send(message);
      }
    }
  }

  /**
   * 获取 Draft 频道的用户数量
   */
  getDraftChannelUserCount(draftId: number): number {
    return this.draftChannels.get(draftId)?.size || 0;
  }

  /**
   * 获取 Draft 频道的所有在线用户
   */
  getDraftChannelUsers(draftId: number): Array<{ userId: number; userName: string }> {
    const clients = this.draftChannels.get(draftId);
    if (!clients) return [];

    const users: Array<{ userId: number; userName: string }> = [];
    const seenUsers = new Set<number>();

    for (const client of clients) {
      const info = this.draftClientInfo.get(client);
      if (info && !seenUsers.has(info.userId)) {
        seenUsers.add(info.userId);
        users.push({ userId: info.userId, userName: info.userName });
      }
    }

    return users;
  }

  /**
   * 清理已断开连接的 WebSocket（从所有频道移除）
   */
  cleanupDisconnectedClient(ws: WebSocket): void {
    // 清理 Project 频道
    const projectInfo = this.clientInfo.get(ws);
    if (projectInfo) {
      this.unsubscribe(ws, projectInfo.projectId);
    }

    // 清理 Draft 频道
    const draftInfo = this.draftClientInfo.get(ws);
    if (draftInfo) {
      this.unsubscribeFromDraft(ws, draftInfo.draftId);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/websocket/channels.ts
git commit -m "$(cat <<'EOF'
feat(server): add Draft channel management to ChannelManager

Add subscribeToDraft, unsubscribeFromDraft, broadcastToDraft,
and related methods for draft-specific WebSocket channels.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 扩展 WebSocket 服务器处理 Draft 消息

**Files:**
- Modify: `packages/server/src/websocket/server.ts`

- [ ] **Step 1: 添加 Draft 消息处理逻辑**

在 `packages/server/src/websocket/server.ts` 中，添加 Draft 消息处理：

首先在文件顶部添加新的类型和导入：

```typescript
// 在现有导入后添加
import {
  parseMessage,
  createChatMessage,
  createDraftMessageEvent,
  createDraftMemberJoinedEvent,
  createDraftMemberLeftEvent,
  createDraftStatusChangedEvent,
  type Message,
} from './types.js';
```

然后在 `WebSocketServer` 类中添加新的消息类型和处理方法：

```typescript
// 在 IncomingMessage 接口中添加
interface DraftSubscribeMessage {
  type: 'draft_subscribe';
  draftId: number;
  userId: number;
  userName: string;
}

interface DraftUnsubscribeMessage {
  type: 'draft_unsubscribe';
  draftId: number;
}

interface IncomingMessage {
  type: string;
  projectId?: number;
  userId?: number;
  userName?: string;
  content?: string;
  draftId?: number;
  [key: string]: unknown;
}
```

在 `handleMessage` 方法的 switch 语句中添加新 case：

```typescript
    switch (parsed.type) {
      case 'subscribe':
        this.handleSubscribe(ws, parsed as SubscribeMessage);
        break;
      case 'chat':
        this.handleChat(ws, parsed as ChatMessageInput);
        break;
      case 'file_change':
        this.handleFileChange(ws, parsed as FileChangeMessage);
        break;
      // 新增 Draft 相关处理
      case 'draft_subscribe':
        this.handleDraftSubscribe(ws, parsed as DraftSubscribeMessage);
        break;
      case 'draft_unsubscribe':
        this.handleDraftUnsubscribe(ws, parsed as DraftUnsubscribeMessage);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
```

在 `WebSocketServer` 类中添加新的处理方法：

```typescript
  /**
   * 处理 Draft 频道订阅
   */
  private handleDraftSubscribe(ws: WebSocket, msg: DraftSubscribeMessage): void {
    this.channels.subscribeToDraft(ws, msg.draftId, msg.userId, msg.userName);

    // 通知频道内其他用户
    const memberJoinedMsg = JSON.stringify(
      createDraftMemberJoinedEvent(
        msg.draftId,
        msg.userId,
        msg.userName,
        this.channels.getDraftChannelUserCount(msg.draftId)
      )
    );
    this.channels.broadcastToDraft(msg.draftId, memberJoinedMsg, ws);

    // 确认订阅成功
    ws.send(
      JSON.stringify({
        type: 'draft_subscribed',
        draftId: msg.draftId,
        memberCount: this.channels.getDraftChannelUserCount(msg.draftId),
        onlineUsers: this.channels.getDraftChannelUsers(msg.draftId),
      })
    );
  }

  /**
   * 处理 Draft 频道取消订阅
   */
  private handleDraftUnsubscribe(ws: WebSocket, msg: DraftUnsubscribeMessage): void {
    const info = this.channels.getDraftClientInfo(ws);
    if (info) {
      this.channels.unsubscribeFromDraft(ws, msg.draftId);

      // 通知其他用户
      const memberLeftMsg = JSON.stringify(
        createDraftMemberLeftEvent(
          msg.draftId,
          info.userId,
          info.userName,
          this.channels.getDraftChannelUserCount(msg.draftId)
        )
      );
      this.channels.broadcastToDraft(msg.draftId, memberLeftMsg);
    }
  }
```

修改 `handleDisconnect` 方法：

```typescript
  private handleDisconnect(ws: WebSocket): void {
    // 处理 Project 频道断开
    const projectInfo = this.channels.getClientInfo(ws);
    if (projectInfo) {
      this.channels.unsubscribe(ws, projectInfo.projectId);

      const userLeftMsg = JSON.stringify({
        type: 'user_left',
        projectId: projectInfo.projectId,
        userId: projectInfo.userId,
        userName: projectInfo.userName,
        timestamp: new Date().toISOString(),
      });
      this.channels.broadcast(projectInfo.projectId, userLeftMsg);
    }

    // 处理 Draft 频道断开
    const draftInfo = this.channels.getDraftClientInfo(ws);
    if (draftInfo) {
      this.channels.unsubscribeFromDraft(ws, draftInfo.draftId);

      const memberLeftMsg = JSON.stringify(
        createDraftMemberLeftEvent(
          draftInfo.draftId,
          draftInfo.userId,
          draftInfo.userName,
          this.channels.getDraftChannelUserCount(draftInfo.draftId)
        )
      );
      this.channels.broadcastToDraft(draftInfo.draftId, memberLeftMsg);
    }
  }
```

添加公开方法供路由调用：

```typescript
  /**
   * 广播 Draft 消息（供路由调用）
   */
  broadcastDraftMessage(draftId: number, message: unknown, excludeUserId?: number): void {
    const msgStr = JSON.stringify(message);
    const clients = this.channels.getDraftChannelClients(draftId);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        const info = this.channels.getDraftClientInfo(client);
        if (!excludeUserId || info?.userId !== excludeUserId) {
          client.send(msgStr);
        }
      }
    }
  }

  /**
   * 获取 Draft 频道在线用户（供路由调用）
   */
  getDraftOnlineUsers(draftId: number): Array<{ userId: number; userName: string }> {
    return this.channels.getDraftChannelUsers(draftId);
  }
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/websocket/server.ts
git commit -m "$(cat <<'EOF'
feat(server): add Draft WebSocket message handling

Add draft_subscribe/draft_unsubscribe handlers, disconnect cleanup,
and broadcastDraftMessage method for use by Draft routes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 集成 WebSocket 广播到 Draft 路由

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`

- [ ] **Step 1: 在 Draft 路由中添加 WebSocket 广播**

在 `packages/server/src/routes/drafts.ts` 文件顶部添加导入：

```typescript
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { getWebSocketServer } from '../websocket/server.js';
import {
  createDraftMessageEvent,
  createDraftMemberJoinedEvent,
  createDraftStatusChangedEvent,
  createDraftMessageConfirmedEvent,
} from '../websocket/types.js';
import type {
  Draft,
  DraftMember,
  DraftStatus,
  CreateDraftInput,
  UpdateDraftInput
} from '../types/draft.js';
```

修改发送消息的路由，添加 WebSocket 广播：

```typescript
  // 发送消息（修改现有代码，添加 WebSocket 广播）
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

      // 新增：WebSocket 广播
      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageEvent(draftId, message as any);
        wsServer.broadcastDraftMessage(draftId, wsMessage, userId);
      }

      res.status(201).json({ message });
    } catch (error) {
      console.error('Failed to send message:', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });
```

修改状态更新路由：

```typescript
  // 更新 Draft 状态（修改现有代码，添加 WebSocket 广播）
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

      // 新增：WebSocket 广播
      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftStatusChangedEvent(draftId, status);
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ draft });
    } catch (error) {
      console.error('Failed to update draft status:', error);
      res.status(500).json({ error: '更新 Draft 状态失败' });
    }
  });
```

修改消息确认路由：

```typescript
  // 确认消息（修改现有代码，添加 WebSocket 广播）
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

      // 获取用户名
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string };

      // 插入或更新确认
      db.prepare(`
        INSERT INTO message_confirmations (message_id, user_id, type, comment)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(message_id, user_id) DO UPDATE SET
          type = excluded.type,
          comment = excluded.comment,
          created_at = datetime('now')
      `).run(messageId, userId, type, comment || null);

      // 新增：WebSocket 广播
      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageConfirmedEvent(
          draftId,
          messageId,
          userId,
          user.name,
          type
        );
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to confirm message:', error);
      res.status(500).json({ error: '确认消息失败' });
    }
  });
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/routes/drafts.ts
git commit -m "$(cat <<'EOF'
feat(server): integrate WebSocket broadcast in Draft routes

Broadcast draft_message, draft_status_changed, and
draft_message_confirmed events via WebSocket.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 编写 WebSocket 测试

**Files:**
- Create: `packages/server/tests/websocket-draft.test.ts`

- [ ] **Step 1: 创建 WebSocket 测试文件**

```typescript
// packages/server/tests/websocket-draft.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type Database from 'better-sqlite3';
import WebSocket from 'ws';
import { getDb, closeDb } from '../src/db/connection.js';
import { initSchema } from '../src/db/schema.js';
import { createAuthRouter } from '../src/routes/auth.js';
import { createDraftsRouter } from '../src/routes/drafts.js';
import { WebSocketServer, resetWebSocketServerInstance } from '../src/websocket/server.js';
import supertest from 'supertest';

describe('Draft WebSocket', () => {
  let db: Database.Database;
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let wsServer: WebSocketServer;
  let authToken: string;
  let userId: number;
  let projectId: number;
  let draftId: number;
  let wsPort: number;

  beforeEach(async () => {
    resetWebSocketServerInstance();
    db = getDb(':memory:');
    initSchema(db);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(db));
    app.use('/api/drafts', createDraftsRouter(db));

    server = createServer(app);
    wsServer = new WebSocketServer(server);

    // 找一个可用端口
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        wsPort = (server.address() as any).port;
        resolve();
      });
    });

    // 创建测试用户
    const registerRes = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // 创建测试项目
    const projectResult = db.prepare(
      'INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)'
    ).run('Test Project', 'node', userId);
    projectId = projectResult.lastInsertRowid as number;

    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(projectId, userId, 'owner');

    // 创建测试 Draft
    const draftRes = await supertest(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ projectId, title: 'Test Draft' });
    draftId = draftRes.body.draft.id;
  });

  afterEach(() => {
    wsServer.close();
    server.close();
    closeDb(db);
  });

  describe('draft_subscribe', () => {
    it('should subscribe to draft channel', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId,
            userId,
            userName: 'Test User',
          }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'draft_subscribed') {
            expect(msg.draftId).toBe(draftId);
            expect(msg.memberCount).toBe(1);
            expect(msg.onlineUsers).toHaveLength(1);
            ws.close();
            resolve();
          }
        });
      });
    });

    it('should notify other users when member joins', async () => {
      const ws1 = new WebSocket(`ws://localhost:${wsPort}`);
      const ws2 = new WebSocket(`ws://localhost:${wsPort}`);

      // 第一个用户订阅
      await new Promise<void>((resolve) => {
        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId,
            userId,
            userName: 'User 1',
          }));
          resolve();
        });
      });

      // 等待订阅确认
      await new Promise<void>((resolve) => {
        ws1.on('message', () => resolve());
      });

      // 第二个用户订阅
      await new Promise<void>((resolve) => {
        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId,
            userId: userId + 1,
            userName: 'User 2',
          }));
          resolve();
        });
      });

      // 第一个用户应该收到 member_joined 通知
      await new Promise<void>((resolve) => {
        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'draft_member_joined') {
            expect(msg.userId).toBe(userId + 1);
            expect(msg.userName).toBe('User 2');
            expect(msg.memberCount).toBe(2);
            ws1.close();
            ws2.close();
            resolve();
          }
        });
      });
    });
  });

  describe('draft_unsubscribe', () => {
    it('should notify other users when member leaves', async () => {
      const ws1 = new WebSocket(`ws://localhost:${wsPort}`);
      const ws2 = new WebSocket(`ws://localhost:${wsPort}`);

      // 两个用户订阅
      await new Promise<void>((resolve) => {
        let connected = 0;
        const checkConnected = () => {
          connected++;
          if (connected === 2) resolve();
        };

        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId,
            userId,
            userName: 'User 1',
          }));
          checkConnected();
        });

        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId,
            userId: userId + 1,
            userName: 'User 2',
          }));
          checkConnected();
        });
      });

      // 用户2 取消订阅
      await new Promise<void>((resolve) => {
        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'draft_member_left') {
            expect(msg.memberCount).toBe(1);
            ws1.close();
            resolve();
          }
        });

        setTimeout(() => {
          ws2.send(JSON.stringify({
            type: 'draft_unsubscribe',
            draftId,
          }));
          ws2.close();
        }, 100);
      });
    });
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
cd /root/my/code-link/packages/server && npm test -- websocket-draft.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/tests/websocket-draft.test.ts
git commit -m "$(cat <<'EOF'
test(server): add Draft WebSocket tests

Add tests for draft_subscribe, draft_unsubscribe,
and member join/leave notifications.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 创建前端 WebSocket Hook

**Files:**
- Create: `packages/web/src/lib/draft-websocket.ts`

- [ ] **Step 1: 创建 Draft WebSocket Hook**

```typescript
// packages/web/src/lib/draft-websocket.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface DraftWSMessage {
  type: string;
  draftId: number;
  timestamp: string;
  [key: string]: unknown;
}

export interface OnlineUser {
  userId: number;
  userName: string;
}

export interface UseDraftWebSocketOptions {
  draftId: number | null;
  userId: number;
  userName: string;
  onMessage?: (message: DraftWSMessage) => void;
  onMemberJoined?: (userId: number, userName: string, memberCount: number) => void;
  onMemberLeft?: (userId: number, userName: string, memberCount: number) => void;
  onStatusChanged?: (status: string) => void;
  onMessageReceived?: (message: unknown) => void;
  onMessageConfirmed?: (messageId: number, userId: number, userName: string, type: string) => void;
}

export interface UseDraftWebSocketReturn {
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  memberCount: number;
  sendMessage: (type: string, data: Record<string, unknown>) => void;
  reconnect: () => void;
}

export function useDraftWebSocket(options: UseDraftWebSocketOptions): UseDraftWebSocketReturn {
  const {
    draftId,
    userId,
    userName,
    onMessage,
    onMemberJoined,
    onMemberLeft,
    onStatusChanged,
    onMessageReceived,
    onMessageConfirmed,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  const connect = useCallback(() => {
    if (!draftId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // 订阅 Draft 频道
      ws.send(JSON.stringify({
        type: 'draft_subscribe',
        draftId,
        userId,
        userName,
      }));
    };

    ws.onclose = () => {
      setIsConnected(false);
      // 自动重连
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as DraftWSMessage;
        onMessage?.(message);

        switch (message.type) {
          case 'draft_subscribed':
            setOnlineUsers((message as any).onlineUsers || []);
            setMemberCount((message as any).memberCount || 0);
            break;

          case 'draft_member_joined':
            const joinedMsg = message as any;
            setMemberCount(joinedMsg.memberCount);
            setOnlineUsers(prev => {
              if (prev.some(u => u.userId === joinedMsg.userId)) return prev;
              return [...prev, { userId: joinedMsg.userId, userName: joinedMsg.userName }];
            });
            onMemberJoined?.(joinedMsg.userId, joinedMsg.userName, joinedMsg.memberCount);
            break;

          case 'draft_member_left':
            const leftMsg = message as any;
            setMemberCount(leftMsg.memberCount);
            setOnlineUsers(prev => prev.filter(u => u.userId !== leftMsg.userId));
            onMemberLeft?.(leftMsg.userId, leftMsg.userName, leftMsg.memberCount);
            break;

          case 'draft_status_changed':
            onStatusChanged?.((message as any).status);
            break;

          case 'draft_message':
            onMessageReceived?.((message as any).message);
            break;

          case 'draft_message_confirmed':
            const confirmMsg = message as any;
            onMessageConfirmed?.(
              confirmMsg.messageId,
              confirmMsg.userId,
              confirmMsg.userName,
              confirmMsg.confirmationType
            );
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }, [draftId, userId, userName, onMessage, onMemberJoined, onMemberLeft, onStatusChanged, onMessageReceived, onMessageConfirmed]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'draft_unsubscribe',
        draftId,
      }));
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [draftId]);

  const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    isConnected,
    onlineUsers,
    memberCount,
    sendMessage,
    reconnect: connect,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/draft-websocket.ts
git commit -m "$(cat <<'EOF'
feat(web): add useDraftWebSocket hook

Add React hook for Draft WebSocket connection with
auto-reconnect, online user tracking, and message callbacks.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 创建在线用户显示组件

**Files:**
- Create: `packages/web/src/components/collaboration/online-users.tsx`

- [ ] **Step 1: 创建在线用户组件**

```typescript
// packages/web/src/components/collaboration/online-users.tsx
'use client';

import type { OnlineUser } from '../../lib/draft-websocket';

interface OnlineUsersProps {
  users: OnlineUser[];
  currentUserId?: number;
  maxDisplay?: number;
}

export function OnlineUsers({ users, currentUserId, maxDisplay = 5 }: OnlineUsersProps) {
  if (users.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        暂无在线成员
      </div>
    );
  }

  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginRight: '4px' }}>
        在线 {users.length} 人:
      </span>
      {displayUsers.map((user) => (
        <div
          key={user.userId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: user.userId === currentUserId ? 'var(--accent-color)' : 'var(--bg-hover)',
            color: user.userId === currentUserId ? 'white' : 'var(--text-primary)',
            fontSize: '11px',
          }}
          title={user.userName}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: user.userId === currentUserId ? 'white' : 'var(--status-success)',
            }}
          />
          <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.userName}
          </span>
        </div>
      ))}
      {remainingCount > 0 && (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/online-users.tsx
git commit -m "$(cat <<'EOF'
feat(web): add OnlineUsers component

Display online draft members with status indicators
and overflow handling for large groups.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成检查

- [ ] 所有测试通过
- [ ] WebSocket 消息类型完整
- [ ] 前端 Hook 可正常连接
- [ ] 在线用户组件渲染正确
- [ ] 代码已提交

---

**Phase 2 完成。后续 Phase 将包括：**
- Phase 3: 前端协作面板 UI
- Phase 4: @AI 指令集成
- Phase 5: Yjs/Hocuspocus 实时同步
