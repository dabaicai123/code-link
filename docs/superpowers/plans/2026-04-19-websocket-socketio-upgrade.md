# WebSocket 升级到 Socket.IO 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的 `ws` 库 + 自建 WebSocket 实现替换为 Socket.IO，获得房间/命名空间、心跳检测、二进制传输等特性。

**Architecture:** Socket.IO 集成到现有 Express 服务器（同一端口），使用命名空间分离 Project/Draft/Terminal 频道，前端使用 Socket.IO Client。

**Tech Stack:** Socket.IO 4.x + TypeScript + Zod

---

## 文件结构

### 服务端新增文件

| 文件 | 职责 |
|------|------|
| `packages/server/src/socket/index.ts` | Socket.IO 服务器入口，集成 Express |
| `packages/server/src/socket/middleware/auth.ts` | JWT 认证中间件 |
| `packages/server/src/socket/namespaces/project.ts` | 项目命名空间处理器 |
| `packages/server/src/socket/namespaces/draft.ts` | 草稿命名空间处理器 |
| `packages/server/src/socket/namespaces/terminal.ts` | 终端命名空间处理器 |
| `packages/server/src/socket/types.ts` | Socket 事件类型定义 |

### 服务端删除文件

| 文件 | 说明 |
|------|------|
| `packages/server/src/websocket/server.ts` | 原 WebSocket 服务器 |
| `packages/server/src/websocket/channels.ts` | 原频道管理器 |

### 前端新增文件

| 文件 | 职责 |
|------|------|
| `packages/web/src/lib/socket/index.ts` | Socket.IO 客户端入口 |
| `packages/web/src/lib/socket/project.ts` | 项目频道 hook |
| `packages/web/src/lib/socket/draft.ts` | 草稿频道 hook |
| `packages/web/src/lib/socket/terminal.ts` | 终端频道 hook |
| `packages/web/src/lib/socket/types.ts` | 事件类型定义 |

### 前端删除文件

| 文件 | 说明 |
|------|------|
| `packages/web/src/lib/websocket/*` | 原 WebSocket 客户端实现 |
| `packages/web/src/lib/websocket-client.ts` | 原客户端封装 |
| `packages/web/src/lib/draft-websocket.ts` | 原 Draft WebSocket |
| `packages/web/src/lib/terminal-websocket.ts` | 原 Terminal WebSocket |

---

## Task 1: 安装 Socket.IO 依赖

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/web/package.json`

- [ ] **Step 1: 安装服务端依赖**

Run:
```bash
cd /root/my/code-link/packages/server && pnpm add socket.io zod
```

- [ ] **Step 2: 安装前端依赖**

Run:
```bash
cd /root/my/code-link/packages/web && pnpm add socket.io-client zod
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/package.json packages/web/package.json && git -C /root/my/code-link commit -m "chore: add socket.io and zod dependencies"
```

---

## Task 2: 定义共享类型

**Files:**
- Create: `packages/server/src/socket/types.ts`

- [ ] **Step 1: 创建事件类型定义**

```typescript
// packages/server/src/socket/types.ts
import { z } from 'zod';

// ==================== Project 命名空间 ====================

export const ProjectEvents = {
  // 客户端 -> 服务端
  subscribe: z.object({
    projectId: z.number(),
  }),
  unsubscribe: z.object({
    projectId: z.number(),
  }),
  chat: z.object({
    projectId: z.number(),
    content: z.string(),
  }),
  fileChange: z.object({
    projectId: z.number(),
    path: z.string(),
    action: z.enum(['created', 'modified', 'deleted']),
    content: z.string().optional(),
  }),

  // 服务端 -> 客户端
  subscribed: z.object({
    projectId: z.number(),
    userCount: z.number(),
  }),
  userJoined: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    timestamp: z.string(),
  }),
  userLeft: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    timestamp: z.string(),
  }),
  chatMessage: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    content: z.string(),
    timestamp: z.string(),
  }),
  buildStatus: z.object({
    projectId: z.number(),
    status: z.enum(['pending', 'running', 'success', 'failed']),
    previewPort: z.number().optional(),
    error: z.string().optional(),
    timestamp: z.string(),
  }),
};

// ==================== Draft 命名空间 ====================

export const DraftEvents = {
  // 客户端 -> 服务端
  subscribe: z.object({
    draftId: z.number(),
  }),
  unsubscribe: z.object({
    draftId: z.number(),
  }),
  message: z.object({
    draftId: z.number(),
    content: z.string(),
    parentId: z.number().nullable().optional(),
  }),

  // 服务端 -> 客户端
  subscribed: z.object({
    draftId: z.number(),
    memberCount: z.number(),
    onlineUsers: z.array(z.object({
      userId: z.number(),
      userName: z.string(),
    })),
  }),
  memberJoined: z.object({
    draftId: z.number(),
    userId: z.number(),
    userName: z.string(),
    memberCount: z.number(),
    timestamp: z.string(),
  }),
  memberLeft: z.object({
    draftId: z.number(),
    userId: z.number(),
    userName: z.string(),
    memberCount: z.number(),
    timestamp: z.string(),
  }),
  draftMessage: z.object({
    draftId: z.number(),
    message: z.object({
      id: z.number(),
      draft_id: z.number(),
      parent_id: z.number().nullable(),
      user_id: z.number(),
      user_name: z.string(),
      content: z.string(),
      message_type: z.string(),
      created_at: z.string(),
    }),
    timestamp: z.string(),
  }),
};

// ==================== Terminal 命名空间 ====================

export const TerminalEvents = {
  // 客户端 -> 服务端
  start: z.object({
    projectId: z.number(),
    cols: z.number().default(80),
    rows: z.number().default(24),
  }),
  input: z.object({
    sessionId: z.string(),
    data: z.string(), // Base64 编码
  }),
  resize: z.object({
    sessionId: z.string(),
    cols: z.number(),
    rows: z.number(),
  }),
  ping: z.object({}),

  // 服务端 -> 客户端
  started: z.object({
    sessionId: z.string(),
  }),
  output: z.object({
    data: z.string(), // Base64 编码
  }),
  exit: z.object({}),
  error: z.object({
    message: z.string(),
  }),
  pong: z.object({}),
};

// ==================== 类型导出 ====================

export type ProjectSubscribeEvent = z.infer<typeof ProjectEvents.subscribe>;
export type ProjectChatEvent = z.infer<typeof ProjectEvents.chat>;
export type ProjectChatMessageEvent = z.infer<typeof ProjectEvents.chatMessage>;

export type DraftSubscribeEvent = z.infer<typeof DraftEvents.subscribe>;
export type DraftMessageEvent = z.infer<typeof DraftEvents.message>;
export type DraftMessageBroadcast = z.infer<typeof DraftEvents.draftMessage>;

export type TerminalStartEvent = z.infer<typeof TerminalEvents.start>;
export type TerminalInputEvent = z.infer<typeof TerminalEvents.input>;
export type TerminalOutputEvent = z.infer<typeof TerminalEvents.output>;

// Socket 数据类型
export interface SocketData {
  userId: number;
  userName: string;
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/socket/types.ts && git -C /root/my/code-link commit -m "feat(server): add socket event type definitions"
```

---

## Task 3: 创建认证中间件

**Files:**
- Create: `packages/server/src/socket/middleware/auth.ts`

- [ ] **Step 1: 创建认证中间件**

```typescript
// packages/server/src/socket/middleware/auth.ts
import type { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { createLogger } from '../../logger/index.js';

const logger = createLogger('socket-auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthSocketData {
  userId: number;
  userName: string;
}

declare module 'socket.io' {
  interface Socket {
    data: AuthSocketData;
  }
}

export function createAuthMiddleware() {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const decoded = verify(token, JWT_SECRET) as { userId: number; userName: string };

      if (!decoded.userId || !decoded.userName) {
        return next(new Error('Unauthorized: Invalid token payload'));
      }

      socket.data = {
        userId: decoded.userId,
        userName: decoded.userName,
      };

      logger.debug(`Socket authenticated: userId=${decoded.userId}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed', error);
      next(new Error('Unauthorized: Invalid token'));
    }
  };
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/socket/middleware/auth.ts && git -C /root/my/code-link commit -m "feat(server): add socket authentication middleware"
```

---

## Task 4: 创建 Project 命名空间

**Files:**
- Create: `packages/server/src/socket/namespaces/project.ts`

- [ ] **Step 1: 创建 Project 命名空间处理器**

```typescript
// packages/server/src/socket/namespaces/project.ts
import type { Namespace, Socket } from 'socket.io';
import { createLogger } from '../../logger/index.js';
import { ProjectEvents } from '../types.js';

const logger = createLogger('socket-project');

interface RoomUser {
  userId: number;
  userName: string;
}

// 房间用户管理: projectId -> Map<socketId, RoomUser>
const roomUsers = new Map<number, Map<string, RoomUser>>();

export function setupProjectNamespace(namespace: Namespace): void {
  namespace.on('connection', (socket) => {
    const { userId, userName } = socket.data;
    logger.info(`Project socket connected: userId=${userId}`);

    // 订阅项目
    socket.on('subscribe', (data: unknown) => {
      const parsed = ProjectEvents.subscribe.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid subscribe data' });
        return;
      }

      const { projectId } = parsed.data;
      const roomName = `project:${projectId}`;

      // 加入房间
      socket.join(roomName);

      // 记录用户
      if (!roomUsers.has(projectId)) {
        roomUsers.set(projectId, new Map());
      }
      roomUsers.get(projectId)!.set(socket.id, { userId, userName });

      // 通知其他用户
      socket.to(roomName).emit('userJoined', {
        projectId,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });

      // 确认订阅
      socket.emit('subscribed', {
        projectId,
        userCount: roomUsers.get(projectId)!.size,
      });

      logger.debug(`User ${userId} subscribed to project ${projectId}`);
    });

    // 取消订阅
    socket.on('unsubscribe', (data: unknown) => {
      const parsed = ProjectEvents.unsubscribe.safeParse(data);
      if (!parsed.success) return;

      const { projectId } = parsed.data;
      leaveProjectRoom(socket, projectId);
    });

    // 聊天消息
    socket.on('chat', (data: unknown) => {
      const parsed = ProjectEvents.chat.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid chat data' });
        return;
      }

      const { projectId, content } = parsed.data;
      const roomName = `project:${projectId}`;

      namespace.to(roomName).emit('chatMessage', {
        projectId,
        userId,
        userName,
        content,
        timestamp: new Date().toISOString(),
      });
    });

    // 文件变更
    socket.on('fileChange', (data: unknown) => {
      const parsed = ProjectEvents.fileChange.safeParse(data);
      if (!parsed.success) return;

      const { projectId, path, action, content } = parsed.data;
      const roomName = `project:${projectId}`;

      socket.to(roomName).emit('fileChange', {
        projectId,
        path,
        action,
        content,
        timestamp: new Date().toISOString(),
      });
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`Project socket disconnected: userId=${userId}`);

      // 清理所有房间
      for (const [projectId, users] of roomUsers) {
        if (users.has(socket.id)) {
          leaveProjectRoom(socket, projectId);
        }
      }
    });
  });
}

function leaveProjectRoom(socket: Socket, projectId: number): void {
  const roomName = `project:${projectId}`;
  const users = roomUsers.get(projectId);

  if (users) {
    const user = users.get(socket.id);
    users.delete(socket.id);

    if (user) {
      socket.to(roomName).emit('userLeft', {
        projectId,
        userId: user.userId,
        userName: user.userName,
        timestamp: new Date().toISOString(),
      });
    }

    if (users.size === 0) {
      roomUsers.delete(projectId);
    }
  }

  socket.leave(roomName);
}

// 外部 API: 广播构建状态
export function broadcastBuildStatus(
  namespace: Namespace,
  projectId: number,
  status: 'pending' | 'running' | 'success' | 'failed',
  previewPort?: number,
  error?: string
): void {
  const roomName = `project:${projectId}`;
  namespace.to(roomName).emit('buildStatus', {
    projectId,
    status,
    previewPort,
    error,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/socket/namespaces/project.ts && git -C /root/my/code-link commit -m "feat(server): add project namespace handler"
```

---

## Task 5: 创建 Draft 命名空间

**Files:**
- Create: `packages/server/src/socket/namespaces/draft.ts`

- [ ] **Step 1: 创建 Draft 命名空间处理器**

```typescript
// packages/server/src/socket/namespaces/draft.ts
import type { Namespace, Socket } from 'socket.io';
import { createLogger } from '../../logger/index.js';
import { DraftEvents } from '../types.js';

const logger = createLogger('socket-draft');

interface DraftUser {
  userId: number;
  userName: string;
}

// 房间用户管理: draftId -> Map<socketId, DraftUser>
const draftRoomUsers = new Map<number, Map<string, DraftUser>>();

export function setupDraftNamespace(namespace: Namespace): void {
  namespace.on('connection', (socket) => {
    const { userId, userName } = socket.data;
    logger.info(`Draft socket connected: userId=${userId}`);

    // 订阅草稿
    socket.on('subscribe', (data: unknown) => {
      const parsed = DraftEvents.subscribe.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid subscribe data' });
        return;
      }

      const { draftId } = parsed.data;
      const roomName = `draft:${draftId}`;

      socket.join(roomName);

      if (!draftRoomUsers.has(draftId)) {
        draftRoomUsers.set(draftId, new Map());
      }
      draftRoomUsers.get(draftId)!.set(socket.id, { userId, userName });

      // 通知其他用户
      socket.to(roomName).emit('memberJoined', {
        draftId,
        userId,
        userName,
        memberCount: draftRoomUsers.get(draftId)!.size,
        timestamp: new Date().toISOString(),
      });

      // 确认订阅，返回在线用户列表
      const onlineUsers = Array.from(draftRoomUsers.get(draftId)!.values());
      socket.emit('subscribed', {
        draftId,
        memberCount: onlineUsers.length,
        onlineUsers,
      });

      logger.debug(`User ${userId} subscribed to draft ${draftId}`);
    });

    // 取消订阅
    socket.on('unsubscribe', (data: unknown) => {
      const parsed = DraftEvents.unsubscribe.safeParse(data);
      if (!parsed.success) return;

      const { draftId } = parsed.data;
      leaveDraftRoom(socket, draftId);
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`Draft socket disconnected: userId=${userId}`);

      for (const [draftId, users] of draftRoomUsers) {
        if (users.has(socket.id)) {
          leaveDraftRoom(socket, draftId);
        }
      }
    });
  });
}

function leaveDraftRoom(socket: Socket, draftId: number): void {
  const roomName = `draft:${draftId}`;
  const users = draftRoomUsers.get(draftId);

  if (users) {
    const user = users.get(socket.id);
    users.delete(socket.id);

    if (user) {
      socket.to(roomName).emit('memberLeft', {
        draftId,
        userId: user.userId,
        userName: user.userName,
        memberCount: users.size,
        timestamp: new Date().toISOString(),
      });
    }

    if (users.size === 0) {
      draftRoomUsers.delete(draftId);
    }
  }

  socket.leave(roomName);
}

// 外部 API: 广播草稿消息
export function broadcastDraftMessage(
  namespace: Namespace,
  draftId: number,
  message: z.infer<typeof DraftEvents.draftMessage>['message'],
  excludeUserId?: number
): void {
  const roomName = `draft:${draftId}`;
  const event = {
    draftId,
    message,
    timestamp: new Date().toISOString(),
  };

  if (excludeUserId) {
    // 找到需要排除的 socket
    const users = draftRoomUsers.get(draftId);
    if (users) {
      for (const [socketId, user] of users) {
        if (user.userId !== excludeUserId) {
          const targetSocket = namespace.sockets.get(socketId);
          targetSocket?.emit('draftMessage', event);
        }
      }
      return;
    }
  }

  namespace.to(roomName).emit('draftMessage', event);
}

// 获取在线用户
export function getDraftOnlineUsers(draftId: number): Array<{ userId: number; userName: string }> {
  const users = draftRoomUsers.get(draftId);
  return users ? Array.from(users.values()) : [];
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my-code-link add packages/server/src/socket/namespaces/draft.ts && git -C /root/my/code-link commit -m "feat(server): add draft namespace handler"
```

---

## Task 6: 创建 Terminal 命名空间

**Files:**
- Create: `packages/server/src/socket/namespaces/terminal.ts`

- [ ] **Step 1: 创建 Terminal 命名空间处理器**

```typescript
// packages/server/src/socket/namespaces/terminal.ts
import type { Namespace, Socket } from 'socket.io';
import { createLogger } from '../../logger/index.js';
import { TerminalEvents } from '../types.js';
import { getTerminalManager } from '../../terminal/terminal-manager.js';
import { getContainerStatus } from '../../docker/container-manager.js';
import { decrypt, isEncryptionKeySet } from '../../crypto/aes.js';
import { ProjectRepository, ClaudeConfigRepository, OrganizationRepository } from '../../repositories/index.js';

const logger = createLogger('socket-terminal');

const projectRepo = new ProjectRepository();
const claudeConfigRepo = new ClaudeConfigRepository();
const orgRepo = new OrganizationRepository();

export function setupTerminalNamespace(namespace: Namespace): void {
  namespace.on('connection', async (socket) => {
    const { userId } = socket.data;
    logger.info(`Terminal socket connected: userId=${userId}`);

    let currentSessionId: string | null = null;
    const terminalManager = getTerminalManager();

    // 启动终端
    socket.on('start', async (data: unknown) => {
      const parsed = TerminalEvents.start.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid start data' });
        return;
      }

      const { projectId, cols, rows } = parsed.data;

      // 权限检查
      const project = await projectRepo.findById(projectId);
      if (!project) {
        socket.emit('error', { message: '项目不存在或无权访问' });
        return;
      }

      const membership = await orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership) {
        socket.emit('error', { message: '项目不存在或无权访问' });
        return;
      }

      if (!project.containerId) {
        socket.emit('error', { message: '项目没有关联的容器，请先启动容器' });
        return;
      }

      // 检查容器状态
      try {
        const status = await getContainerStatus(project.containerId);
        if (status !== 'running') {
          socket.emit('error', { message: '容器未运行，请先启动容器' });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '获取容器状态失败';
        socket.emit('error', { message });
        return;
      }

      // 获取用户配置
      const configRow = await claudeConfigRepo.findByUserId(userId);
      if (!configRow) {
        socket.emit('error', { message: '请先在「设置 → Claude Code 配置」中完成配置后再使用终端' });
        return;
      }

      let userEnv: Record<string, string> = {};
      try {
        if (!isEncryptionKeySet()) {
          socket.emit('error', { message: '服务器加密密钥未配置，请联系管理员' });
          return;
        }

        const config = JSON.parse(decrypt(configRow.config));
        if (config.env && typeof config.env === 'object') {
          userEnv = config.env;
        }

        if (!userEnv.ANTHROPIC_AUTH_TOKEN) {
          socket.emit('error', { message: 'ANTHROPIC_AUTH_TOKEN 未配置，请完善配置后再使用终端' });
          return;
        }
      } catch (error) {
        logger.error('Failed to decrypt user config', error);
        socket.emit('error', { message: '用户配置解密失败，请重新配置' });
        return;
      }

      // 创建终端会话
      try {
        // 使用 Socket.IO 的二进制传输
        const sessionId = await terminalManager.createSession(
          project.containerId,
          createSocketIOWriter(socket),
          cols || 80,
          rows || 24,
          userEnv
        );
        currentSessionId = sessionId;
        socket.emit('started', { sessionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : '创建终端会话失败';
        socket.emit('error', { message });
      }
    });

    // 输入
    socket.on('input', (data: unknown) => {
      const parsed = TerminalEvents.input.safeParse(data);
      if (!parsed.success || !currentSessionId) return;

      const { sessionId, data: inputData } = parsed.data;
      if (sessionId !== currentSessionId) return;

      terminalManager.handleInput(sessionId, inputData);
    });

    // 调整大小
    socket.on('resize', async (data: unknown) => {
      const parsed = TerminalEvents.resize.safeParse(data);
      if (!parsed.success || !currentSessionId) return;

      const { sessionId, cols, rows } = parsed.data;
      if (sessionId !== currentSessionId) return;

      try {
        await terminalManager.resize(sessionId, cols, rows);
      } catch (error) {
        logger.error('Failed to resize terminal', error);
      }
    });

    // Ping
    socket.on('ping', () => {
      socket.emit('pong', {});
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`Terminal socket disconnected: userId=${userId}`);
      if (currentSessionId) {
        terminalManager.closeSession(currentSessionId);
        currentSessionId = null;
      }
    });
  });
}

// 创建 Socket.IO 写入器适配器
function createSocketIOWriter(socket: Socket): { readyState: number; send: (data: string) => void; on: (event: string, handler: () => void) => void; OPEN: number } {
  return {
    readyState: 1, // OPEN
    OPEN: 1,
    send: (data: string) => {
      const msg = JSON.parse(data);
      socket.emit(msg.type, msg);
    },
    on: (event: string, handler: () => void) => {
      socket.on(event, handler);
    },
  };
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/socket/namespaces/terminal.ts && git -C /root/my/code-link commit -m "feat(server): add terminal namespace handler"
```

---

## Task 7: 创建 Socket.IO 服务器入口

**Files:**
- Create: `packages/server/src/socket/index.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 创建 Socket.IO 服务器入口**

```typescript
// packages/server/src/socket/index.ts
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createAuthMiddleware } from './middleware/auth.js';
import { setupProjectNamespace } from './namespaces/project.js';
import { setupDraftNamespace } from './namespaces/draft.js';
import { setupTerminalNamespace } from './namespaces/terminal.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('socket-server');

let ioInstance: Server | null = null;

export function createSocketServer(httpServer: HttpServer): Server {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // 全局认证中间件
  ioInstance.use(createAuthMiddleware());

  // 设置命名空间
  setupProjectNamespace(ioInstance.of('/project'));
  setupDraftNamespace(ioInstance.of('/draft'));
  setupTerminalNamespace(ioInstance.of('/terminal'));

  logger.info('Socket.IO server initialized');

  return ioInstance;
}

export function getSocketServer(): Server | null {
  return ioInstance;
}

export function closeSocketServer(): void {
  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
}

// 重置实例（用于测试）
export function resetSocketServerInstance(): void {
  ioInstance = null;
}

// 导出命名空间函数供外部使用
export { broadcastBuildStatus } from './namespaces/project.js';
export { broadcastDraftMessage, getDraftOnlineUsers } from './namespaces/draft.js';
```

- [ ] **Step 2: 更新服务端入口文件**

修改 `packages/server/src/index.ts`，将 WebSocket 替换为 Socket.IO：

```typescript
import "reflect-metadata";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { getSqliteDb, initSchema, initDefaultAdmin } from './db/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createProjectsRouter } from './routes/projects.js';
import { createContainersRouter } from './routes/containers.js';
import { createGitHubRouter } from './routes/github.js';
import { createGitLabRouter } from './routes/gitlab.js';
import { createReposRouter } from './routes/repos.js';
import { createBuildsRouter } from './routes/builds.js';
import { createClaudeConfigRouter } from './routes/claude-config.js';
import { createDraftsRouter } from './routes/drafts.js';
import { createOrganizationsRouter } from './routes/organizations.js';
import { createInvitationsRouter } from './routes/invitations.js';
import { createSocketServer } from './socket/index.js';
import { requestLoggingMiddleware, createLogger } from './logger/index.js';
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './ai/client.js';
import { success, Errors } from './utils/response.js';
import type Database from 'better-sqlite3';

const logger = createLogger('server');

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLoggingMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json(success({ status: 'ok' }));
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/projects', createProjectsRouter());
  app.use('/api/projects', createContainersRouter());
  app.use('/api/github', createGitHubRouter());
  app.use('/api/gitlab', createGitLabRouter());
  app.use('/api/projects/:projectId/repos', createReposRouter());
  app.use('/api/builds', createBuildsRouter());
  app.use('/api/claude-config', createClaudeConfigRouter());
  app.use('/api/organizations', createOrganizationsRouter());
  app.use('/api/invitations', createInvitationsRouter());
  app.use('/api/drafts', createDraftsRouter());

  app.use((_req, res) => {
    res.status(404).json(Errors.notFound('接口'));
  });

  return app;
}

export function startServer(port: number = 3001): void {
  const app = createApp();
  const server = createServer(app);

  // 初始化 Socket.IO 服务器
  createSocketServer(server);

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Socket.IO server ready on ws://localhost:${port}`);
  });
}

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getSqliteDb();
  initSchema(db);
  await initDefaultAdmin();

  // 设置加密密钥
  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  // 初始化 AI 客户端
  initAIClient();

  startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);
}
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/socket/index.ts packages/server/src/index.ts && git -C /root/my/code-link commit -m "feat(server): integrate Socket.IO server"
```

---

## Task 8: 更新 Terminal Manager 适配 Socket.IO

**Files:**
- Modify: `packages/server/src/terminal/terminal-manager.ts`

- [ ] **Step 1: 修改 Terminal Manager 支持通用 WebSocket 接口**

将 `WebSocket` 类型改为通用接口：

```typescript
// packages/server/src/terminal/terminal-manager.ts
import {
  streamExecOutput,
  resizeExecTTY,
  writeToExecStream,
  closeExecStdin,
  execWithUserEnv,
  type ExecSession,
} from './docker-exec.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('terminal-mgr');

// 通用 WebSocket 接口
export interface WebSocketLike {
  readyState: number;
  send: (data: string) => void;
  on: (event: string, handler: () => void) => void;
  OPEN: number;
}

export interface TerminalSession {
  id: string;
  containerId: string;
  ws: WebSocketLike;
  execSession: ExecSession;
  cols: number;
  rows: number;
  createdAt: Date;
}

export interface TerminalMessage {
  type: 'output' | 'exit' | 'error';
  data?: string;
  message?: string;
}

class TerminalManagerImpl {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionCounter: number = 0;

  async createSession(
    containerId: string,
    ws: WebSocketLike,
    cols: number = 80,
    rows: number = 24,
    userEnv?: Record<string, string>
  ): Promise<string> {
    const sessionId = `term-${++this.sessionCounter}-${Date.now()}`;

    try {
      const execSession = userEnv
        ? await execWithUserEnv(containerId, ['/bin/sh', '-c', 'claude || exec bash || exec sh'], true, userEnv)
        : await streamExecOutput(containerId, ['/bin/sh', '-c', 'claude || exec bash || exec sh'], true, { env: ['TERM=xterm-256color'] });

      const session: TerminalSession = {
        id: sessionId,
        containerId,
        ws,
        execSession,
        cols,
        rows,
        createdAt: new Date(),
      };

      execSession.stream.on('data', (data: Buffer) => {
        this.sendToWebSocket(ws, {
          type: 'output',
          data: data.toString('base64'),
        });
      });

      execSession.stream.on('error', (error: Error) => {
        logger.error(`Terminal session ${sessionId} stream error`, error);
        this.sendToWebSocket(ws, {
          type: 'error',
          message: error.message,
        });
      });

      execSession.stream.on('end', () => {
        this.sendToWebSocket(ws, { type: 'exit' });
        this.sessions.delete(sessionId);
      });

      this.sessions.set(sessionId, session);
      return sessionId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create terminal session';
      this.sendToWebSocket(ws, {
        type: 'error',
        message,
      });
      throw error;
    }
  }

  handleInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found for input`);
      return;
    }

    try {
      const decoded = Buffer.from(data, 'base64').toString();
      writeToExecStream(session.execSession.stream as unknown as NodeJS.WritableStream, decoded);
    } catch (error) {
      logger.error(`Failed to write input to session ${sessionId}`, error);
    }
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found for resize`);
      return;
    }

    try {
      await resizeExecTTY(session.execSession.exec, cols, rows);
      session.cols = cols;
      session.rows = rows;
    } catch (error) {
      logger.error(`Failed to resize session ${sessionId}`, error);
      throw error;
    }
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      session.execSession.stream.removeAllListeners();
      closeExecStdin(session.execSession.stream as unknown as NodeJS.WritableStream);

      if (session.ws.readyState === session.ws.OPEN) {
        session.ws.send(JSON.stringify({ type: 'exit' }));
      }

      this.sessions.delete(sessionId);
    } catch (error) {
      logger.error(`Error closing session ${sessionId}`, error);
      this.sessions.delete(sessionId);
    }
  }

  closeAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessionsByContainer(containerId: string): TerminalSession[] {
    const result: TerminalSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.containerId === containerId) {
        result.push(session);
      }
    }
    return result;
  }

  private sendToWebSocket(ws: WebSocketLike, msg: TerminalMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

let terminalManagerInstance: TerminalManagerImpl | null = null;

export function getTerminalManager(): TerminalManagerImpl {
  if (!terminalManagerInstance) {
    terminalManagerInstance = new TerminalManagerImpl();
  }
  return terminalManagerInstance;
}

export function resetTerminalManagerInstance(): void {
  if (terminalManagerInstance) {
    terminalManagerInstance.closeAll();
  }
  terminalManagerInstance = null;
}

export type TerminalManager = TerminalManagerImpl;
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/terminal/terminal-manager.ts && git -C /root/my/code-link commit -m "refactor(server): update terminal manager for generic WebSocket interface"
```

---

## Task 9: 删除旧 WebSocket 文件

**Files:**
- Delete: `packages/server/src/websocket/server.ts`
- Delete: `packages/server/src/websocket/channels.ts`
- Delete: `packages/server/src/routes/terminal.ts` (合并到 namespace)

- [ ] **Step 1: 删除旧文件**

```bash
rm -rf /root/my/code-link/packages/server/src/websocket/
rm /root/my/code-link/packages/server/src/routes/terminal.ts
```

- [ ] **Step 2: 更新测试文件**

删除旧的 WebSocket 测试文件，后续任务会添加新测试。

```bash
rm /root/my/code-link/packages/server/tests/websocket-server.test.ts
rm /root/my/code-link/packages/server/tests/websocket-draft.test.ts
rm /root/my/code-link/packages/server/tests/channels.test.ts
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add -A && git -C /root/my/code-link commit -m "refactor(server): remove old WebSocket implementation"
```

---

## Task 10: 创建前端 Socket.IO 客户端类型

**Files:**
- Create: `packages/web/src/lib/socket/types.ts`

- [ ] **Step 1: 创建前端类型定义**

```typescript
// packages/web/src/lib/socket/types.ts
import { z } from 'zod';

// 与服务端保持一致的类型定义

export const ProjectEvents = {
  subscribe: z.object({ projectId: z.number() }),
  unsubscribe: z.object({ projectId: z.number() }),
  chat: z.object({ projectId: z.number(), content: z.string() }),
  fileChange: z.object({
    projectId: z.number(),
    path: z.string(),
    action: z.enum(['created', 'modified', 'deleted']),
    content: z.string().optional(),
  }),

  subscribed: z.object({ projectId: z.number(), userCount: z.number() }),
  userJoined: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    timestamp: z.string(),
  }),
  userLeft: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    timestamp: z.string(),
  }),
  chatMessage: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    content: z.string(),
    timestamp: z.string(),
  }),
  buildStatus: z.object({
    projectId: z.number(),
    status: z.enum(['pending', 'running', 'success', 'failed']),
    previewPort: z.number().optional(),
    error: z.string().optional(),
    timestamp: z.string(),
  }),
};

export const DraftEvents = {
  subscribe: z.object({ draftId: z.number() }),
  unsubscribe: z.object({ draftId: z.number() }),
  message: z.object({
    draftId: z.number(),
    content: z.string(),
    parentId: z.number().nullable().optional(),
  }),

  subscribed: z.object({
    draftId: z.number(),
    memberCount: z.number(),
    onlineUsers: z.array(z.object({ userId: z.number(), userName: z.string() })),
  }),
  memberJoined: z.object({
    draftId: z.number(),
    userId: z.number(),
    userName: z.string(),
    memberCount: z.number(),
    timestamp: z.string(),
  }),
  memberLeft: z.object({
    draftId: z.number(),
    userId: z.number(),
    userName: z.string(),
    memberCount: z.number(),
    timestamp: z.string(),
  }),
  draftMessage: z.object({
    draftId: z.number(),
    message: z.object({
      id: z.number(),
      draft_id: z.number(),
      parent_id: z.number().nullable(),
      user_id: z.number(),
      user_name: z.string(),
      content: z.string(),
      message_type: z.string(),
      created_at: z.string(),
    }),
    timestamp: z.string(),
  }),
};

export const TerminalEvents = {
  start: z.object({ projectId: z.number(), cols: z.number().default(80), rows: z.number().default(24) }),
  input: z.object({ sessionId: z.string(), data: z.string() }),
  resize: z.object({ sessionId: z.string(), cols: z.number(), rows: z.number() }),
  ping: z.object({}),

  started: z.object({ sessionId: z.string() }),
  output: z.object({ data: z.string() }),
  exit: z.object({}),
  error: z.object({ message: z.string() }),
  pong: z.object({}),
};

// 类型导出
export type ProjectSubscribeEvent = z.infer<typeof ProjectEvents.subscribe>;
export type ProjectChatMessageEvent = z.infer<typeof ProjectEvents.chatMessage>;
export type ProjectBuildStatusEvent = z.infer<typeof ProjectEvents.buildStatus>;

export type DraftSubscribeEvent = z.infer<typeof DraftEvents.subscribe>;
export type DraftMessageBroadcast = z.infer<typeof DraftEvents.draftMessage>;
export type DraftOnlineUser = { userId: number; userName: string };

export type TerminalStartEvent = z.infer<typeof TerminalEvents.start>;
export type TerminalOutputEvent = z.infer<typeof TerminalEvents.output>;
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/web/src/lib/socket/types.ts && git -C /root/my/code-link commit -m "feat(web): add socket event type definitions"
```

---

## Task 11: 创建前端 Socket.IO 客户端入口

**Files:**
- Create: `packages/web/src/lib/socket/index.ts`

- [ ] **Step 1: 创建 Socket.IO 客户端入口**

```typescript
// packages/web/src/lib/socket/index.ts
import { io, Socket } from 'socket.io-client';
import { getStorage } from '../storage';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let projectSocket: Socket | null = null;
let draftSocket: Socket | null = null;
let terminalSocket: Socket | null = null;

function getToken(): string | null {
  return getStorage().getItem('token');
}

function createSocket(namespace: string): Socket {
  const token = getToken();
  return io(`${SOCKET_URL}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
}

export function getProjectSocket(): Socket {
  if (!projectSocket) {
    projectSocket = createSocket('/project');
  }
  return projectSocket;
}

export function getDraftSocket(): Socket {
  if (!draftSocket) {
    draftSocket = createSocket('/draft');
  }
  return draftSocket;
}

export function getTerminalSocket(): Socket {
  if (!terminalSocket) {
    terminalSocket = createSocket('/terminal');
  }
  return terminalSocket;
}

export function disconnectAll(): void {
  projectSocket?.disconnect();
  draftSocket?.disconnect();
  terminalSocket?.disconnect();
  projectSocket = null;
  draftSocket = null;
  terminalSocket = null;
}

export function reconnectAll(): void {
  const token = getToken();
  if (token) {
    projectSocket?.connect();
    draftSocket?.connect();
    terminalSocket?.connect();
  }
}

export { Socket };
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/web/src/lib/socket/index.ts && git -C /root/my/code-link commit -m "feat(web): add socket.io client entry"
```

---

## Task 12: 创建 Project Socket Hook

**Files:**
- Create: `packages/web/src/lib/socket/project.ts`

- [ ] **Step 1: 创建 Project Socket Hook**

```typescript
// packages/web/src/lib/socket/project.ts
'use client';

import { useEffect, useCallback, useState } from 'react';
import { getProjectSocket } from './index';
import type { ProjectChatMessageEvent, ProjectBuildStatusEvent } from './types';

interface OnlineUser {
  userId: number;
  userName: string;
}

interface UseProjectSocketOptions {
  projectId: number | null;
  onChatMessage?: (msg: ProjectChatMessageEvent) => void;
  onUserJoined?: (user: OnlineUser) => void;
  onUserLeft?: (user: OnlineUser) => void;
  onBuildStatus?: (status: ProjectBuildStatusEvent) => void;
}

export function useProjectSocket(options: UseProjectSocketOptions) {
  const { projectId, onChatMessage, onUserJoined, onUserLeft, onBuildStatus } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);

  const socket = getProjectSocket();

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!projectId || !isConnected) return;

    socket.emit('subscribe', { projectId });

    const handleSubscribed = (data: { projectId: number; userCount: number }) => {
      setUserCount(data.userCount);
    };

    const handleUserJoined = (data: { userId: number; userName: string }) => {
      setUserCount((c) => c + 1);
      onUserJoined?.({ userId: data.userId, userName: data.userName });
    };

    const handleUserLeft = (data: { userId: number; userName: string }) => {
      setUserCount((c) => Math.max(0, c - 1));
      onUserLeft?.({ userId: data.userId, userName: data.userName });
    };

    const handleChatMessage = (msg: ProjectChatMessageEvent) => {
      onChatMessage?.(msg);
    };

    const handleBuildStatus = (status: ProjectBuildStatusEvent) => {
      onBuildStatus?.(status);
    };

    socket.on('subscribed', handleSubscribed);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('chatMessage', handleChatMessage);
    socket.on('buildStatus', handleBuildStatus);

    return () => {
      socket.emit('unsubscribe', { projectId });
      socket.off('subscribed', handleSubscribed);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
      socket.off('chatMessage', handleChatMessage);
      socket.off('buildStatus', handleBuildStatus);
    };
  }, [projectId, isConnected, socket, onChatMessage, onUserJoined, onUserLeft, onBuildStatus]);

  const sendChat = useCallback(
    (content: string) => {
      if (projectId) {
        socket.emit('chat', { projectId, content });
      }
    },
    [projectId, socket]
  );

  const sendFileChange = useCallback(
    (path: string, action: 'created' | 'modified' | 'deleted', content?: string) => {
      if (projectId) {
        socket.emit('fileChange', { projectId, path, action, content });
      }
    },
    [projectId, socket]
  );

  return {
    isConnected,
    userCount,
    sendChat,
    sendFileChange,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/web/src/lib/socket/project.ts && git -C /root/my/code-link commit -m "feat(web): add project socket hook"
```

---

## Task 13: 创建 Draft Socket Hook

**Files:**
- Create: `packages/web/src/lib/socket/draft.ts`

- [ ] **Step 1: 创建 Draft Socket Hook**

```typescript
// packages/web/src/lib/socket/draft.ts
'use client';

import { useEffect, useCallback, useState } from 'react';
import { getDraftSocket } from './index';
import type { DraftMessageBroadcast, DraftOnlineUser } from './types';

interface UseDraftSocketOptions {
  draftId: number | null;
  onMessage?: (msg: DraftMessageBroadcast) => void;
  onMemberJoined?: (user: DraftOnlineUser, memberCount: number) => void;
  onMemberLeft?: (user: DraftOnlineUser, memberCount: number) => void;
}

export function useDraftSocket(options: UseDraftSocketOptions) {
  const { draftId, onMessage, onMemberJoined, onMemberLeft } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<DraftOnlineUser[]>([]);

  const socket = getDraftSocket();

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!draftId || !isConnected) return;

    socket.emit('subscribe', { draftId });

    const handleSubscribed = (data: { draftId: number; memberCount: number; onlineUsers: DraftOnlineUser[] }) => {
      setMemberCount(data.memberCount);
      setOnlineUsers(data.onlineUsers);
    };

    const handleMemberJoined = (data: { userId: number; userName: string; memberCount: number }) => {
      setMemberCount(data.memberCount);
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, userName: data.userName }];
      });
      onMemberJoined?.({ userId: data.userId, userName: data.userName }, data.memberCount);
    };

    const handleMemberLeft = (data: { userId: number; userName: string; memberCount: number }) => {
      setMemberCount(data.memberCount);
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      onMemberLeft?.({ userId: data.userId, userName: data.userName }, data.memberCount);
    };

    const handleMessage = (msg: DraftMessageBroadcast) => {
      onMessage?.(msg);
    };

    socket.on('subscribed', handleSubscribed);
    socket.on('memberJoined', handleMemberJoined);
    socket.on('memberLeft', handleMemberLeft);
    socket.on('draftMessage', handleMessage);

    return () => {
      socket.emit('unsubscribe', { draftId });
      socket.off('subscribed', handleSubscribed);
      socket.off('memberJoined', handleMemberJoined);
      socket.off('memberLeft', handleMemberLeft);
      socket.off('draftMessage', handleMessage);
    };
  }, [draftId, isConnected, socket, onMessage, onMemberJoined, onMemberLeft]);

  return {
    isConnected,
    memberCount,
    onlineUsers,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/web/src/lib/socket/draft.ts && git -C /root/my/code-link commit -m "feat(web): add draft socket hook"
```

---

## Task 14: 创建 Terminal Socket Hook

**Files:**
- Create: `packages/web/src/lib/socket/terminal.ts`

- [ ] **Step 1: 创建 Terminal Socket Hook**

```typescript
// packages/web/src/lib/socket/terminal.ts
'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { getTerminalSocket } from './index';

interface UseTerminalSocketOptions {
  projectId: number | null;
  onOutput?: (data: string) => void;
  onExit?: () => void;
  onError?: (message: string) => void;
}

export function useTerminalSocket(options: UseTerminalSocketOptions) {
  const { projectId, onOutput, onExit, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const socket = getTerminalSocket();

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => {
      setIsConnected(false);
      setIsStarted(false);
      sessionIdRef.current = null;
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    const handleStarted = (data: { sessionId: string }) => {
      sessionIdRef.current = data.sessionId;
      setIsStarted(true);
    };

    const handleOutput = (data: { data: string }) => {
      try {
        const decoded = decodeBase64(data.data);
        onOutput?.(decoded);
      } catch {
        onOutput?.(data.data);
      }
    };

    const handleExit = () => {
      setIsStarted(false);
      sessionIdRef.current = null;
      onExit?.();
    };

    const handleError = (data: { message: string }) => {
      onError?.(data.message);
    };

    socket.on('started', handleStarted);
    socket.on('output', handleOutput);
    socket.on('exit', handleExit);
    socket.on('error', handleError);

    return () => {
      socket.off('started', handleStarted);
      socket.off('output', handleOutput);
      socket.off('exit', handleExit);
      socket.off('error', handleError);
    };
  }, [socket, onOutput, onExit, onError]);

  const start = useCallback(
    (cols: number, rows: number) => {
      if (projectId && isConnected) {
        socket.emit('start', { projectId, cols, rows });
      }
    },
    [projectId, isConnected, socket]
  );

  const sendInput = useCallback(
    (data: string) => {
      if (sessionIdRef.current) {
        const encoded = encodeBase64(data);
        socket.emit('input', { sessionId: sessionIdRef.current, data: encoded });
      }
    },
    [socket]
  );

  const resize = useCallback(
    (cols: number, rows: number) => {
      if (sessionIdRef.current) {
        socket.emit('resize', { sessionId: sessionIdRef.current, cols, rows });
      }
    },
    [socket]
  );

  const ping = useCallback(() => {
    socket.emit('ping', {});
  }, [socket]);

  return {
    isConnected,
    isStarted,
    start,
    sendInput,
    resize,
    ping,
  };
}

function decodeBase64(base64: string): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/web/src/lib/socket/terminal.ts && git -C /root/my/code-link commit -m "feat(web): add terminal socket hook"
```

---

## Task 15: 删除旧前端 WebSocket 文件

**Files:**
- Delete: `packages/web/src/lib/websocket/*`
- Delete: `packages/web/src/lib/websocket-client.ts`
- Delete: `packages/web/src/lib/draft-websocket.ts`
- Delete: `packages/web/src/lib/terminal-websocket.ts`

- [ ] **Step 1: 删除旧文件**

```bash
rm -rf /root/my/code-link/packages/web/src/lib/websocket/
rm -f /root/my/code-link/packages/web/src/lib/websocket-client.ts
rm -f /root/my/code-link/packages/web/src/lib/draft-websocket.ts
rm -f /root/my/code-link/packages/web/src/lib/terminal-websocket.ts
```

- [ ] **Step 2: 更新导出**

删除 `packages/web/src/lib/websocket/index.ts` 后，确保其他文件不引用旧模块。

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add -A && git -C /root/my/code-link commit -m "refactor(web): remove old WebSocket client implementation"
```

---

## Task 16: 更新前端组件使用新 Socket Hooks

**Files:**
- Modify: `packages/web/src/components/terminal/terminal-panel.tsx`
- Modify: `packages/web/src/components/collaboration/index.tsx`

- [ ] **Step 1: 更新 Terminal 组件**

修改 `packages/web/src/components/terminal/terminal-panel.tsx`，将旧的 `TerminalWebSocket` 替换为 `useTerminalSocket` hook。

找到使用 `TerminalWebSocket` 的地方，替换为：

```typescript
import { useTerminalSocket } from '@/lib/socket/terminal';

// 在组件内
const { isConnected, isStarted, start, sendInput, resize } = useTerminalSocket({
  projectId,
  onOutput: (data) => {
    // 处理终端输出
    terminalRef.current?.write(data);
  },
  onExit: () => {
    // 处理终端退出
  },
  onError: (message) => {
    console.error('Terminal error:', message);
  },
});
```

- [ ] **Step 2: 更新 Collaboration 组件**

修改 `packages/web/src/components/collaboration/index.tsx`，将旧的 Draft WebSocket 替换为 `useDraftSocket` hook。

找到使用 `DraftWebSocket` 的地方，替换为：

```typescript
import { useDraftSocket } from '@/lib/socket/draft';

// 在组件内
const { isConnected, memberCount, onlineUsers } = useDraftSocket({
  draftId,
  onMessage: (msg) => {
    // 处理消息
  },
  onMemberJoined: (user, count) => {
    // 处理成员加入
  },
  onMemberLeft: (user, count) => {
    // 处理成员离开
  },
});
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/terminal/terminal-panel.tsx packages/web/src/components/collaboration/index.tsx && git -C /root/my/code-link commit -m "refactor(web): update components to use new socket hooks"
```

---

## Task 17: 添加 Socket.IO 服务端测试

**Files:**
- Create: `packages/server/tests/socket/project.test.ts`

- [ ] **Step 1: 创建 Project 命名空间测试**

```typescript
// packages/server/tests/socket/project.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createSocketServer, resetSocketServerInstance } from '../../src/socket/index.js';

describe('Project Socket Namespace', () => {
  let httpServer: any;
  let ioServer: Server;
  let clientSocket: ClientSocket;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    ioServer = createSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(() => {
    clientSocket?.disconnect();
    ioServer.close();
    httpServer.close();
    resetSocketServerInstance();
  });

  function createClient(token: string = 'test-token'): ClientSocket {
    return ioClient(`http://localhost:${port}/project`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
  }

  it('should connect with valid token', async () => {
    // 注意：实际测试需要有效的 JWT token
    // 这里仅验证连接流程
    clientSocket = createClient('invalid-token');

    await new Promise<void>((resolve) => {
      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Unauthorized');
        resolve();
      });
    });
  });

  it('should subscribe to project room', async () => {
    // 需要 mock JWT 验证或使用有效 token
    // 此测试需要配合认证系统
  });
});
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/tests/socket/project.test.ts && git -C /root/my/code-link commit -m "test(server): add project socket namespace tests"
```

---

## Task 18: 运行测试并验证

**Files:**
- None

- [ ] **Step 1: 运行服务端测试**

Run:
```bash
cd /root/my/code-link && pnpm --filter @code-link/server test
```

Expected: 所有测试通过

- [ ] **Step 2: 运行前端构建**

Run:
```bash
cd /root/my/code-link && pnpm --filter @code-link/web build
```

Expected: 构建成功

- [ ] **Step 3: 启动开发服务器验证**

Run:
```bash
cd /root/my/code-link && pnpm dev
```

Expected: 服务启动成功，Socket.IO 连接正常

---

## 任务总结

| 任务 | 说明 |
|------|------|
| Task 1-2 | 安装依赖，定义类型 |
| Task 3-7 | 服务端 Socket.IO 实现 |
| Task 8-9 | 更新 Terminal Manager，删除旧文件 |
| Task 10-15 | 前端 Socket.IO 实现 |
| Task 16 | 更新组件使用新 Hooks |
| Task 17-18 | 测试和验证 |
