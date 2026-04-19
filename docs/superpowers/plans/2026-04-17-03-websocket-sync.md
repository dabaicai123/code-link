# WebSocket 实时同步实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现实时同步机制 — 文件变更广播到所有在线用户、项目内聊天频道、构建状态推送，让多用户协作感知彼此操作。

**Architecture:** 服务端使用 ws 库建立 WebSocket 服务器，前端使用原生 WebSocket API 连接。消息类型包括：文件变更事件、聊天消息、构建状态通知。每个项目对应一个频道，用户加入项目页面时订阅该频道，离开时取消订阅。

**Tech Stack:** ws (Node.js WebSocket 库), 原生 WebSocket API (前端)

---

## 文件结构

```
packages/server/
├── src/
│   ├── websocket/
│   │   ├── server.ts             # WebSocket 服务器
│   │   ├── channels.ts           # 频道管理（项目级订阅）
│   │   ├── handlers.ts           # 消息处理器
│   │   └── types.ts              # WebSocket 消息类型定义
│   ├── index.ts                  # 挂载 WebSocket 服务器
│   └── types.ts                  # 更新类型定义
├── tests/
│   ├── websocket-server.test.ts  # WebSocket 服务器测试
│   └── channels.test.ts          # 频道管理测试

packages/web/
├── src/
│   ├── lib/
│   │   ├── websocket-client.ts   # WebSocket 客户端封装
│   │   └── use-websocket.ts      # React Hook
│   └── hooks/
│       └── use-project-sync.ts   # 项目同步 Hook
├── tests/
│   └── websocket-client.test.ts
```

---

### Task 1: WebSocket 消息类型定义

**Files:**
- Create: `packages/server/src/websocket/types.ts`
- Create: `packages/server/tests/ws-types.test.ts`

- [ ] **Step 1: 写消息类型测试**

```typescript
// tests/ws-types.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseMessage,
  createFileChangeEvent,
  createChatMessage,
  createBuildNotification,
  isFileChangeEvent,
  isChatMessage,
} from '../src/websocket/types.ts';

describe('WebSocket Message Types', () => {
  it('should parse valid JSON message', () => {
    const raw = '{"type":"file_change","projectId":1,"path":"src/index.ts"}';
    const msg = parseMessage(raw);
    expect(msg.type).toBe('file_change');
    expect(msg.projectId).toBe(1);
  });

  it('should create file change event', () => {
    const event = createFileChangeEvent(1, 'src/index.ts', 'modified', 'console.log("hello");');
    expect(event.type).toBe('file_change');
    expect(event.path).toBe('src/index.ts');
    expect(event.action).toBe('modified');
  });

  it('should create chat message', () => {
    const msg = createChatMessage(1, 123, 'Hello everyone!');
    expect(msg.type).toBe('chat');
    expect(msg.userId).toBe(123);
    expect(msg.content).toBe('Hello everyone!');
  });

  it('should create build notification', () => {
    const notif = createBuildNotification(1, 'success', 3001);
    expect(notif.type).toBe('build_status');
    expect(notif.status).toBe('success');
    expect(notif.previewPort).toBe(3001);
  });

  it('should correctly identify message types', () => {
    const fileEvent = createFileChangeEvent(1, 'test.ts', 'created');
    const chatMsg = createChatMessage(1, 1, 'hi');

    expect(isFileChangeEvent(fileEvent)).toBe(true);
    expect(isFileChangeEvent(chatMsg)).toBe(false);
    expect(isChatMessage(chatMsg)).toBe(true);
  });
});
```

- [ ] **Step 2: 实现消息类型**

```typescript
// src/websocket/types.ts
export type MessageType =
  | 'file_change'
  | 'chat'
  | 'build_status'
  | 'user_joined'
  | 'user_left'
  | 'error';

export type FileAction = 'created' | 'modified' | 'deleted';

export interface BaseMessage {
  type: MessageType;
  projectId: number;
  timestamp: string;
}

export interface FileChangeEvent extends BaseMessage {
  type: 'file_change';
  path: string;
  action: FileAction;
  content?: string;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  userId: number;
  userName: string;
  content: string;
}

export interface BuildNotification extends BaseMessage {
  type: 'build_status';
  status: 'pending' | 'running' | 'success' | 'failed';
  previewPort?: number;
  error?: string;
}

export interface UserEvent extends BaseMessage {
  type: 'user_joined' | 'user_left';
  userId: number;
  userName: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export type Message =
  | FileChangeEvent
  | ChatMessage
  | BuildNotification
  | UserEvent
  | ErrorMessage;

export function parseMessage(raw: string): Message | null {
  try {
    const msg = JSON.parse(raw);
    if (!msg.type || !msg.projectId) return null;
    return msg as Message;
  } catch {
    return null;
  }
}

export function createFileChangeEvent(
  projectId: number,
  path: string,
  action: FileAction,
  content?: string
): FileChangeEvent {
  return {
    type: 'file_change',
    projectId,
    path,
    action,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createChatMessage(
  projectId: number,
  userId: number,
  userName: string,
  content: string
): ChatMessage {
  return {
    type: 'chat',
    projectId,
    userId,
    userName,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createBuildNotification(
  projectId: number,
  status: BuildNotification['status'],
  previewPort?: number,
  error?: string
): BuildNotification {
  return {
    type: 'build_status',
    projectId,
    status,
    previewPort,
    error,
    timestamp: new Date().toISOString(),
  };
}

export function isFileChangeEvent(msg: Message): msg is FileChangeEvent {
  return msg.type === 'file_change';
}

export function isChatMessage(msg: Message): msg is ChatMessage {
  return msg.type === 'chat';
}

export function isBuildNotification(msg: Message): msg is BuildNotification {
  return msg.type === 'build_status';
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/ws-types.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/websocket/types.ts packages/server/tests/ws-types.test.ts
git commit -m "feat: add WebSocket message type definitions"
```

---

### Task 2: 频道管理

**Files:**
- Create: `packages/server/src/websocket/channels.ts`
- Create: `packages/server/tests/channels.test.ts`

- [ ] **Step 1: 写频道管理测试**

```typescript
// tests/channels.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelManager } from '../src/websocket/channels.ts';
import type { IncomingMessage } from 'http';
import WebSocket from 'ws';

describe('ChannelManager', () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  it('should add client to channel', () => {
    const mockWs = {} as WebSocket;
    const mockReq = { headers: {} } as IncomingMessage;

    manager.subscribe(mockWs, 1, 100, 'test-user');

    const clients = manager.getChannelClients(1);
    expect(clients.size).toBe(1);
    expect(clients.has(mockWs)).toBe(true);
  });

  it('should remove client from channel', () => {
    const mockWs = {} as WebSocket;

    manager.subscribe(mockWs, 1, 100, 'test-user');
    manager.unsubscribe(mockWs, 1);

    const clients = manager.getChannelClients(1);
    expect(clients.size).toBe(0);
  });

  it('should get user info for a client', () => {
    const mockWs = {} as WebSocket;

    manager.subscribe(mockWs, 1, 100, 'test-user');

    const userInfo = manager.getClientInfo(mockWs);
    expect(userInfo?.userId).toBe(100);
    expect(userInfo?.userName).toBe('test-user');
  });

  it('should broadcast message to all clients in channel', () => {
    const mockWs1 = { send: vi.fn() } as unknown as WebSocket;
    const mockWs2 = { send: vi.fn() } as unknown as WebSocket;
    const mockWs3 = { send: vi.fn() } as unknown as WebSocket;

    manager.subscribe(mockWs1, 1, 100, 'user1');
    manager.subscribe(mockWs2, 1, 101, 'user2');
    manager.subscribe(mockWs3, 2, 102, 'user3');

    const message = JSON.stringify({ type: 'chat', content: 'hello' });
    manager.broadcast(1, message, mockWs1); // 排除发送者

    expect(mockWs1.send).not.toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalledWith(message);
    expect(mockWs3.send).not.toHaveBeenCalled(); // 不同频道
  });
});
```

- [ ] **Step 2: 实现频道管理器**

```typescript
// src/websocket/channels.ts
import WebSocket from 'ws';

interface ClientInfo {
  userId: number;
  userName: string;
  projectId: number;
}

export class ChannelManager {
  // projectId -> Set<WebSocket>
  private channels: Map<number, Set<WebSocket>> = new Map();
  
  // WebSocket -> ClientInfo
  private clientInfo: Map<WebSocket, ClientInfo> = new Map();

  subscribe(ws: WebSocket, projectId: number, userId: number, userName: string): void {
    // 添加到频道
    if (!this.channels.has(projectId)) {
      this.channels.set(projectId, new Set());
    }
    this.channels.get(projectId)!.add(ws);

    // 保存客户端信息
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
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/channels.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/websocket/channels.ts packages/server/tests/channels.test.ts
git commit -m "feat: add WebSocket channel manager"
```

---

### Task 3: WebSocket 服务器

**Files:**
- Create: `packages/server/src/websocket/server.ts`
- Create: `packages/server/tests/websocket-server.test.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/package.json`

- [ ] **Step 1: 添加 ws 依赖**

```bash
cd packages/server && pnpm add ws && pnpm add -D @types/ws
```

- [ ] **Step 2: 写 WebSocket 服务器测试**

```typescript
// tests/websocket-server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import { createWebSocketServer, WebSocketServer } from '../src/websocket/server.ts';

describe('WebSocket Server', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    wsServer = createWebSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(() => {
    wsServer.close();
    httpServer.close();
  });

  it('should accept WebSocket connections', async () => {
    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        client.close();
        resolve();
      });
    });
  });

  it('should handle subscription messages', async () => {
    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'subscribe',
          projectId: 1,
          userId: 100,
          userName: 'test-user',
        }));

        client.once('message', (data) => {
          const msg = JSON.parse(data.toString());
          expect(msg.type).toBe('subscribed');
          expect(msg.projectId).toBe(1);
          client.close();
          resolve();
        });
      });
    });
  });

  it('should broadcast messages to same channel', async () => {
    const client1 = new WebSocket(`ws://localhost:${port}`);
    const client2 = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      let connected = 0;

      const onOpen = () => {
        connected++;
        if (connected === 2) {
          // 两个客户端都订阅同一个项目
          client1.send(JSON.stringify({
            type: 'subscribe',
            projectId: 1,
            userId: 100,
            userName: 'user1',
          }));

          client2.send(JSON.stringify({
            type: 'subscribe',
            projectId: 1,
            userId: 101,
            userName: 'user2',
          }));
        }
      };

      client1.on('open', onOpen);
      client2.on('open', onOpen);

      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribed') {
          // client2 订阅成功后，client1 发送聊天消息
          client1.send(JSON.stringify({
            type: 'chat',
            projectId: 1,
            userId: 100,
            userName: 'user1',
            content: 'Hello!',
          }));
        } else if (msg.type === 'chat') {
          expect(msg.content).toBe('Hello!');
          expect(msg.userId).toBe(100);
          client1.close();
          client2.close();
          resolve();
        }
      });
    });
  });
});
```

- [ ] **Step 3: 实现 WebSocket 服务器**

```typescript
// src/websocket/server.ts
import WebSocket, { WebSocketServer as WSServer } from 'ws';
import type { Server as HttpServer } from 'http';
import { ChannelManager } from './channels.ts';
import {
  parseMessage,
  createChatMessage,
  isChatMessage,
  type Message,
} from './types.ts';

export class WebSocketServer {
  private wss: WSServer;
  private channels: ChannelManager;

  constructor(server: HttpServer) {
    this.wss = new WSServer({ server });
    this.channels = new ChannelManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');

      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    const msg = parseMessage(raw);
    if (!msg) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    switch (msg.type) {
      case 'subscribe':
        this.handleSubscribe(ws, msg);
        break;
      case 'chat':
        this.handleChat(ws, msg);
        break;
      case 'file_change':
        this.handleFileChange(ws, msg);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private handleSubscribe(
    ws: WebSocket,
    msg: { projectId: number; userId: number; userName: string }
  ): void {
    this.channels.subscribe(ws, msg.projectId, msg.userId, msg.userName);

    // 通知频道内其他用户
    const userJoinedMsg = JSON.stringify({
      type: 'user_joined',
      projectId: msg.projectId,
      userId: msg.userId,
      userName: msg.userName,
      timestamp: new Date().toISOString(),
    });
    this.channels.broadcast(msg.projectId, userJoinedMsg, ws);

    // 确认订阅成功
    ws.send(
      JSON.stringify({
        type: 'subscribed',
        projectId: msg.projectId,
        userCount: this.channels.getChannelUserCount(msg.projectId),
      })
    );
  }

  private handleChat(ws: WebSocket, msg: any): void {
    const chatMsg = createChatMessage(
      msg.projectId,
      msg.userId,
      msg.userName,
      msg.content
    );

    this.channels.broadcast(msg.projectId, JSON.stringify(chatMsg), ws);
  }

  private handleFileChange(ws: WebSocket, msg: any): void {
    // 广播文件变更到其他客户端
    this.channels.broadcast(msg.projectId, JSON.stringify(msg), ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    const info = this.channels.getClientInfo(ws);
    if (info) {
      this.channels.unsubscribe(ws, info.projectId);

      // 通知其他用户
      const userLeftMsg = JSON.stringify({
        type: 'user_left',
        projectId: info.projectId,
        userId: info.userId,
        userName: info.userName,
        timestamp: new Date().toISOString(),
      });
      this.channels.broadcast(info.projectId, userLeftMsg);
    }
  }

  // 供外部调用：广播构建状态
  broadcastBuildStatus(projectId: number, status: string, previewPort?: number): void {
    const msg = JSON.stringify({
      type: 'build_status',
      projectId,
      status,
      previewPort,
      timestamp: new Date().toISOString(),
    });
    this.channels.broadcast(projectId, msg);
  }

  close(): void {
    this.wss.close();
  }
}

let wsServerInstance: WebSocketServer | null = null;

export function createWebSocketServer(server: HttpServer): WebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new WebSocketServer(server);
  }
  return wsServerInstance;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wsServerInstance;
}
```

- [ ] **Step 4: 在 index.ts 中集成 WebSocket 服务器**

```typescript
// src/index.ts - 修改现有的 createApp 函数
import { createServer } from 'http';
import { createWebSocketServer } from './websocket/server.ts';

export function createApp(db: Database.Database): express.Application {
  const app = express();
  // ... 现有中间件和路由
  return app;
}

export function startServer(db: Database.Database, port: number = 3001): void {
  const app = createApp(db);
  const server = createServer(app);

  // 初始化 WebSocket 服务器
  createWebSocketServer(server);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`WebSocket server ready on ws://localhost:${port}`);
  });
}

// 启动入口
if (process.env.NODE_ENV !== 'test') {
  const db = getDatabase();
  startServer(db);
}
```

- [ ] **Step 5: 运行测试验证**

```bash
cd packages/server && pnpm test tests/websocket-server.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/websocket/server.ts packages/server/tests/websocket-server.test.ts packages/server/src/index.ts packages/server/package.json
git commit -m "feat: add WebSocket server with channel support"
```

---

### Task 4: 前端 WebSocket 客户端

**Files:**
- Create: `packages/web/src/lib/websocket-client.ts`
- Create: `packages/web/src/lib/use-websocket.ts`
- Create: `packages/web/tests/websocket-client.test.ts`

- [ ] **Step 1: 写 WebSocket 客户端测试**

```typescript
// tests/websocket-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from '../src/lib/websocket-client.ts';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  const mockUrl = 'ws://localhost:3001';

  beforeEach(() => {
    global.WebSocket = vi.fn().mockImplementation(() => ({
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    }));
  });

  afterEach(() => {
    client?.disconnect();
  });

  it('should create connection', () => {
    client = new WebSocketClient(mockUrl);
    expect(global.WebSocket).toHaveBeenCalledWith(mockUrl);
  });

  it('should subscribe to project channel', (done) => {
    client = new WebSocketClient(mockUrl);

    client.on('subscribed', (data) => {
      expect(data.projectId).toBe(1);
      done();
    });

    // 模拟连接成功
    (client as any).ws.readyState = 1;
    client.subscribe(1, 100, 'test-user');

    // 模拟服务器响应
    (client as any).ws.onmessage({ data: JSON.stringify({ type: 'subscribed', projectId: 1 }) });
  });

  it('should emit chat messages', (done) => {
    client = new WebSocketClient(mockUrl);

    client.on('chat', (data) => {
      expect(data.content).toBe('Hello!');
      done();
    });

    const mockMessage = {
      type: 'chat',
      projectId: 1,
      userId: 100,
      userName: 'test',
      content: 'Hello!',
    };

    (client as any).ws.onmessage({ data: JSON.stringify(mockMessage) });
  });

  it('should send chat messages', () => {
    client = new WebSocketClient(mockUrl);
    (client as any).ws.readyState = 1;

    client.sendChat(1, 100, 'test', 'Hello everyone!');

    expect((client as any).ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'chat',
        projectId: 1,
        userId: 100,
        userName: 'test',
        content: 'Hello everyone!',
      })
    );
  });
});
```

- [ ] **Step 2: 实现 WebSocket 客户端**

```typescript
// src/lib/websocket-client.ts
type EventHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.emit('disconnected', {});
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  subscribe(projectId: number, userId: number, userName: string): void {
    this.send({
      type: 'subscribe',
      projectId,
      userId,
      userName,
    });
  }

  sendChat(projectId: number, userId: number, userName: string, content: string): void {
    this.send({
      type: 'chat',
      projectId,
      userId,
      userName,
      content,
    });
  }

  private send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 3: 创建 React Hook**

```typescript
// src/lib/use-websocket.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient } from './websocket-client';

interface UseWebSocketOptions {
  url: string;
  projectId?: number;
  userId?: number;
  userName?: string;
}

export function useWebSocket({
  url,
  projectId,
  userId,
  userName,
}: UseWebSocketOptions) {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    clientRef.current = new WebSocketClient(url);

    clientRef.current.on('connected', () => setIsConnected(true));
    clientRef.current.on('disconnected', () => setIsConnected(false));

    return () => {
      clientRef.current?.disconnect();
    };
  }, [url]);

  useEffect(() => {
    if (isConnected && projectId && userId && userName) {
      clientRef.current?.subscribe(projectId, userId, userName);
    }
  }, [isConnected, projectId, userId, userName]);

  const onMessage = useCallback((eventType: string, handler: (data: any) => void) => {
    clientRef.current?.on(eventType, handler);
    return () => clientRef.current?.off(eventType, handler);
  }, []);

  const sendChat = useCallback(
    (content: string) => {
      if (projectId && userId && userName) {
        clientRef.current?.sendChat(projectId, userId, userName, content);
      }
    },
    [projectId, userId, userName]
  );

  return {
    isConnected,
    onMessage,
    sendChat,
  };
}
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/web && pnpm test tests/websocket-client.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/websocket-client.ts packages/web/src/lib/use-websocket.ts packages/web/tests/websocket-client.test.ts
git commit -m "feat: add frontend WebSocket client with React hook"
```

---

### Task 5: 项目同步 Hook

**Files:**
- Create: `packages/web/src/hooks/use-project-sync.ts`

- [ ] **Step 1: 实现项目同步 Hook**

```typescript
// src/hooks/use-project-sync.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../lib/use-websocket';

interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  content?: string;
}

interface ChatMessage {
  id: string;
  userId: number;
  userName: string;
  content: string;
  timestamp: string;
}

interface BuildStatus {
  status: 'pending' | 'running' | 'success' | 'failed';
  previewPort?: number;
}

interface OnlineUser {
  userId: number;
  userName: string;
}

export function useProjectSync(
  projectId: number,
  userId: number,
  userName: string
) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

  const { isConnected, onMessage, sendChat } = useWebSocket({
    url: wsUrl,
    projectId,
    userId,
    userName,
  });

  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // 监听文件变更
    unsubscribers.push(
      onMessage('file_change', (data) => {
        setFileChanges((prev) => [...prev, data]);
      })
    );

    // 监听聊天消息
    unsubscribers.push(
      onMessage('chat', (data) => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `${data.userId}-${Date.now()}`,
            userId: data.userId,
            userName: data.userName,
            content: data.content,
            timestamp: data.timestamp,
          },
        ]);
      })
    );

    // 监听用户加入
    unsubscribers.push(
      onMessage('user_joined', (data) => {
        setOnlineUsers((prev) => {
          if (prev.some((u) => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, userName: data.userName }];
        });
      })
    );

    // 监听用户离开
    unsubscribers.push(
      onMessage('user_left', (data) => {
        setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      })
    );

    // 监听构建状态
    unsubscribers.push(
      onMessage('build_status', (data) => {
        setBuildStatus({
          status: data.status,
          previewPort: data.previewPort,
        });
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [onMessage]);

  const clearFileChanges = useCallback(() => {
    setFileChanges([]);
  }, []);

  return {
    isConnected,
    fileChanges,
    chatMessages,
    onlineUsers,
    buildStatus,
    sendChat,
    clearFileChanges,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/hooks/use-project-sync.ts
git commit -m "feat: add project sync hook for real-time collaboration"
```

---

### Task 6: 全量测试 + 端到端验证

**Files:**
- None (测试现有功能)

- [ ] **Step 1: 运行所有测试**

```bash
cd packages/server && pnpm test
cd packages/web && pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 2: 手动验证 WebSocket 功能**

```bash
# 启动服务器
cd packages/server && pnpm dev

# 使用 wscat 测试（需要安装：npm install -g wscat）
wscat -c ws://localhost:3001

# 在 wscat 中发送订阅消息
> {"type":"subscribe","projectId":1,"userId":100,"userName":"test-user"}

# 在另一个终端打开第二个 wscat 连接，订阅同一项目
> {"type":"subscribe","projectId":1,"userId":101,"userName":"another-user"}

# 第一个连接发送聊天消息
> {"type":"chat","projectId":1,"userId":100,"userName":"test-user","content":"Hello!"}

# 第二个连接应该收到消息
< {"type":"chat","projectId":1,"userId":100,"userName":"test-user","content":"Hello!","timestamp":"..."}
```

Expected: 聊天消息正常广播

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: verify WebSocket real-time sync end-to-end"
```