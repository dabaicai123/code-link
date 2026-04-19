# 前端架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统性重构前端架构，统一 WebSocket 实现、合并重复 API 客户端、统一类型定义，提升代码质量和可维护性。

**Architecture:** 创建 WebSocket 基类，各实现继承扩展；合并 drafts-api 到 api.ts；集中类型定义到 types/ 目录；创建 storage 工具类。

**Tech Stack:** Next.js 16, React 19, TypeScript

---

## 文件结构

```
packages/web/src/
├── lib/
│   ├── websocket/
│   │   ├── base.ts              # 新建：WebSocket 基类
│   │   ├── terminal.ts          # 新建：终端 WebSocket
│   │   ├── draft.ts             # 新建：Draft WebSocket
│   │   └── index.ts             # 新建：统一导出
│   ├── api.ts                   # 修改：合并 drafts API
│   ├── storage.ts               # 新建：localStorage 工具
│   ├── websocket-client.ts      # 删除
│   ├── terminal-websocket.ts    # 删除
│   ├── draft-websocket.ts       # 删除
│   ├── use-websocket.ts         # 删除
│   └── drafts-api.ts            # 删除
├── types/
│   ├── index.ts                 # 新建：统一导出
│   ├── api.ts                   # 新建：API 类型
│   ├── project.ts               # 新建：Project 类型
│   ├── websocket.ts             # 新建：WebSocket 消息类型
│   └── draft.ts                 # 修改：添加导出
└── hooks/
    └── use-websocket.ts         # 修改：使用新的 WebSocket 基类
```

---

### Task 1: 创建 WebSocket 基类

**Files:**
- Create: `packages/web/src/lib/websocket/base.ts`
- Create: `packages/web/tests/websocket-base.test.ts`

- [ ] **Step 1: 写 WebSocket 基类测试**

```typescript
// tests/websocket-base.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketBase } from '../src/lib/websocket/base.ts';

describe('WebSocketBase', () => {
  let base: WebSocketBase;
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    base?.disconnect();
    vi.useRealTimers();
  });

  it('should create connection', () => {
    base = new WebSocketBase(mockUrl);
    expect(global.WebSocket).toHaveBeenCalledWith(mockUrl);
  });

  it('should emit connected event on open', (done) => {
    base = new WebSocketBase(mockUrl);
    base.on('connected', () => {
      expect(base.isConnected()).toBe(true);
      done();
    });
    (base as any).ws.readyState = 1;
    (base as any).ws.onopen();
  });

  it('should emit disconnected event on close', (done) => {
    base = new WebSocketBase(mockUrl);
    base.on('disconnected', () => {
      done();
    });
    (base as any).ws.onclose();
  });

  it('should emit message event on data', (done) => {
    base = new WebSocketBase(mockUrl);
    base.on('message', (data: any) => {
      expect(data.type).toBe('test');
      done();
    });
    (base as any).ws.onmessage({ data: JSON.stringify({ type: 'test' }) });
  });

  it('should attempt reconnect with exponential backoff', () => {
    base = new WebSocketBase(mockUrl, { maxReconnectAttempts: 3 });
    (base as any).ws.onclose();

    vi.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    expect(global.WebSocket).toHaveBeenCalledTimes(3);
  });

  it('should stop reconnecting after max attempts', () => {
    base = new WebSocketBase(mockUrl, { maxReconnectAttempts: 2 });
    base.on('error', (err: any) => {
      expect(err.message).toContain('Max reconnect');
    });

    (base as any).ws.onclose();
    vi.advanceTimersByTime(1000);
    (base as any).ws.onclose();
    vi.advanceTimersByTime(2000);
    (base as any).ws.onclose();
  });

  it('should send data when connected', () => {
    base = new WebSocketBase(mockUrl);
    (base as any).ws.readyState = 1;

    base.send({ type: 'test', data: 'hello' });

    expect((base as any).ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test', data: 'hello' })
    );
  });

  it('should not send when disconnected', () => {
    base = new WebSocketBase(mockUrl);
    (base as any).ws.readyState = 0;

    const warnSpy = vi.spyOn(console, 'warn');
    base.send({ type: 'test' });

    expect(warnSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd packages/web && pnpm test tests/websocket-base.test.ts
```

Expected: FAIL（文件不存在）

- [ ] **Step 3: 实现 WebSocket 基类**

```typescript
// src/lib/websocket/base.ts
type EventHandler = (data: unknown) => void;

export interface WebSocketBaseOptions {
  url: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
}

export class WebSocketBase {
  protected ws: WebSocket | null = null;
  protected url: string;
  protected handlers: Map<string, Set<EventHandler>> = new Map();
  protected reconnectAttempts = 0;
  protected maxReconnectAttempts: number;
  protected reconnectBaseDelay: number;
  protected reconnectMaxDelay: number;
  protected reconnectTimeout: NodeJS.Timeout | null = null;
  protected isManualDisconnect = false;

  constructor(options: WebSocketBaseOptions | string) {
    if (typeof options === 'string') {
      this.url = options;
      this.maxReconnectAttempts = 5;
      this.reconnectBaseDelay = 1000;
      this.reconnectMaxDelay = 30000;
    } else {
      this.url = options.url;
      this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
      this.reconnectBaseDelay = options.reconnectBaseDelay ?? 1000;
      this.reconnectMaxDelay = options.reconnectMaxDelay ?? 30000;
    }

    this.connect();
  }

  protected connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
        // 派发到具体消息类型
        if (data.type) {
          this.emit(data.type, data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.emit('disconnected', {});
      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    };
  }

  protected attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('error', { message: 'Max reconnect attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      this.reconnectMaxDelay
    );

    console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
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

  protected emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd packages/web && pnpm test tests/websocket-base.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/websocket/base.ts packages/web/tests/websocket-base.test.ts
git commit -m "feat: add WebSocketBase class for unified WebSocket management"
```

---

### Task 2: 创建 TerminalWebSocket（继承基类）

**Files:**
- Create: `packages/web/src/lib/websocket/terminal.ts`
- Modify: `packages/web/src/components/terminal/terminal-panel.tsx`

- [ ] **Step 1: 实现 TerminalWebSocket**

```typescript
// src/lib/websocket/terminal.ts
import { WebSocketBase } from './base';

export interface TerminalMessage {
  type: string;
  sessionId?: string;
  cols?: number;
  rows?: number;
  data?: string;
  message?: string;
}

type OutputHandler = (data: string) => void;
type ExitHandler = () => void;
type ErrorHandler = (message: string) => void;
type StartedHandler = (sessionId: string) => void;

export class TerminalWebSocket extends WebSocketBase {
  private sessionId: string | null = null;
  private projectId: string;
  private userId: string;

  // 便捷处理器
  private onOutputHandler: OutputHandler | null = null;
  private onExitHandler: ExitHandler | null = null;
  private onErrorHandler: ErrorHandler | null = null;
  private onStartedHandler: StartedHandler | null = null;

  constructor(baseUrl: string, projectId: string, userId: string) {
    const url = `${baseUrl}?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
    super(url);
    this.projectId = projectId;
    this.userId = userId;

    // 设置消息处理器
    this.on('message', this.handleTerminalMessage.bind(this));
  }

  private handleTerminalMessage(message: TerminalMessage): void {
    switch (message.type) {
      case 'started':
        if (message.sessionId) {
          this.sessionId = message.sessionId;
          this.onStartedHandler?.(message.sessionId);
        }
        break;

      case 'output':
        if (message.data) {
          try {
            const decoded = this.decodeBase64(message.data);
            this.onOutputHandler?.(decoded);
          } catch {
            this.onOutputHandler?.(message.data);
          }
        }
        break;

      case 'exit':
        this.sessionId = null;
        this.onExitHandler?.();
        break;

      case 'error':
        this.onErrorHandler?.(message.message || 'Unknown error');
        break;

      case 'pong':
        break;

      default:
        console.warn('Unknown terminal message type:', message.type);
    }
  }

  start(cols: number, rows: number): void {
    this.send({
      type: 'start',
      cols,
      rows,
    });
  }

  sendInput(data: string): void {
    if (!this.sessionId) {
      console.warn('No active session, cannot send input');
      return;
    }

    const encoded = this.encodeBase64(data);
    this.send({
      type: 'input',
      sessionId: this.sessionId,
      data: encoded,
    });
  }

  resize(cols: number, rows: number): void {
    if (!this.sessionId) return;

    this.send({
      type: 'resize',
      sessionId: this.sessionId,
      cols,
      rows,
    });
  }

  ping(): void {
    this.send({ type: 'ping' });
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  // 便捷设置器
  setOnOutput(handler: OutputHandler): void {
    this.onOutputHandler = handler;
  }

  setOnExit(handler: ExitHandler): void {
    this.onExitHandler = handler;
  }

  setOnError(handler: ErrorHandler): void {
    this.onErrorHandler = handler;
  }

  setOnStarted(handler: StartedHandler): void {
    this.onStartedHandler = handler;
  }

  private decodeBase64(base64: string): string {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  private encodeBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
```

- [ ] **Step 2: 更新 terminal-panel.tsx 使用新的 TerminalWebSocket**

修改 `packages/web/src/components/terminal/terminal-panel.tsx` 第 3 行导入：

```typescript
// 原来的导入
import { TerminalWebSocket } from '@/lib/terminal-websocket';

// 改为
import { TerminalWebSocket } from '@/lib/websocket/terminal';
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/websocket/terminal.ts packages/web/src/components/terminal/terminal-panel.tsx
git commit -m "refactor: TerminalWebSocket now inherits WebSocketBase"
```

---

### Task 3: 创建 DraftWebSocket（继承基类）

**Files:**
- Create: `packages/web/src/lib/websocket/draft.ts`
- Modify: `packages/web/src/hooks/use-draft-websocket.ts`（如存在）

- [ ] **Step 1: 实现 DraftWebSocket 类**

```typescript
// src/lib/websocket/draft.ts
import { WebSocketBase } from './base';

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

export class DraftWebSocket extends WebSocketBase {
  private draftId: number | null = null;
  private userId: number;
  private userName: string;

  constructor(baseUrl: string, userId: number, userName: string) {
    super(baseUrl);
    this.userId = userId;
    this.userName = userName;

    this.on('message', this.handleDraftMessage.bind(this));
  }

  subscribe(draftId: number): void {
    this.draftId = draftId;
    this.send({
      type: 'draft_subscribe',
      draftId,
      userId: this.userId,
      userName: this.userName,
    });
  }

  unsubscribe(): void {
    if (this.draftId) {
      this.send({
        type: 'draft_unsubscribe',
        draftId: this.draftId,
      });
      this.draftId = null;
    }
  }

  sendMessage(type: string, data: Record<string, unknown>): void {
    this.send({ type, ...data });
  }

  private handleDraftMessage(message: DraftWSMessage): void {
    // 消息已通过基类的 emit 派发到具体类型
    // 这里可以添加额外的处理逻辑
  }

  getDraftId(): number | null {
    return this.draftId;
  }
}
```

- [ ] **Step 2: 创建新的 useDraftWebSocket Hook**

```typescript
// src/hooks/use-draft-websocket.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DraftWebSocket, OnlineUser } from '@/lib/websocket/draft';

export interface UseDraftWebSocketOptions {
  draftId: number | null;
  userId: number;
  userName: string;
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
    onMemberJoined,
    onMemberLeft,
    onStatusChanged,
    onMessageReceived,
    onMessageConfirmed,
  } = options;

  const wsRef = useRef<DraftWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

  useEffect(() => {
    wsRef.current = new DraftWebSocket(wsUrl, userId, userName);

    wsRef.current.on('connected', () => setIsConnected(true));
    wsRef.current.on('disconnected', () => setIsConnected(false));

    wsRef.current.on('draft_subscribed', (data: any) => {
      setOnlineUsers(data.onlineUsers || []);
      setMemberCount(data.memberCount || 0);
    });

    wsRef.current.on('draft_member_joined', (data: any) => {
      setMemberCount(data.memberCount);
      setOnlineUsers(prev => {
        if (prev.some(u => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, userName: data.userName }];
      });
      onMemberJoined?.(data.userId, data.userName, data.memberCount);
    });

    wsRef.current.on('draft_member_left', (data: any) => {
      setMemberCount(data.memberCount);
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      onMemberLeft?.(data.userId, data.userName, data.memberCount);
    });

    wsRef.current.on('draft_status_changed', (data: any) => {
      onStatusChanged?.(data.status);
    });

    wsRef.current.on('draft_message', (data: any) => {
      onMessageReceived?.(data.message);
    });

    wsRef.current.on('draft_message_confirmed', (data: any) => {
      onMessageConfirmed?.(data.messageId, data.userId, data.userName, data.confirmationType);
    });

    return () => {
      wsRef.current?.unsubscribe();
      wsRef.current?.disconnect();
    };
  }, [wsUrl, userId, userName]);

  useEffect(() => {
    if (isConnected && draftId) {
      wsRef.current?.subscribe(draftId);
    }
  }, [isConnected, draftId]);

  const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
    wsRef.current?.sendMessage(type, data);
  }, []);

  const reconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = new DraftWebSocket(wsUrl, userId, userName);
  }, [wsUrl, userId, userName]);

  return {
    isConnected,
    onlineUsers,
    memberCount,
    sendMessage,
    reconnect,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/websocket/draft.ts packages/web/src/hooks/use-draft-websocket.ts
git commit -m "refactor: DraftWebSocket now inherits WebSocketBase"
```

---

### Task 4: 创建 WebSocket 索导出

**Files:**
- Create: `packages/web/src/lib/websocket/index.ts`

- [ ] **Step 1: 创建导出文件**

```typescript
// src/lib/websocket/index.ts
export { WebSocketBase, WebSocketBaseOptions } from './base';
export { TerminalWebSocket, TerminalMessage } from './terminal';
export { DraftWebSocket, DraftWSMessage, OnlineUser } from './draft';
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/websocket/index.ts
git commit -m "feat: add websocket module exports"
```

---

### Task 5: 创建 storage 工具类

**Files:**
- Create: `packages/web/src/lib/storage.ts`
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: 实现 storage 工具类**

```typescript
// src/lib/storage.ts
const TOKEN_KEY = 'token';
const ORG_ID_KEY = 'currentOrganizationId';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export const storage = {
  getToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
  },

  getOrgId(): number | null {
    if (!isBrowser()) return null;
    const id = localStorage.getItem(ORG_ID_KEY);
    return id ? parseInt(id, 10) : null;
  },

  setOrgId(id: number): void {
    if (!isBrowser()) return;
    localStorage.setItem(ORG_ID_KEY, String(id));
  },

  removeOrgId(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ORG_ID_KEY);
  },

  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_ID_KEY);
  },
};
```

- [ ] **Step 2: 更新 api.ts 使用 storage**

修改 `packages/web/src/lib/api.ts`，替换 localStorage 相关代码：

```typescript
// 添加导入
import { storage } from './storage';

// 替换 getToken 函数（约第 28-33 行）
// 删除原来的 getToken 函数，改为：
function getToken(): string | null {
  return storage.getToken();
}

// 替换 setToken 函数（约第 38-41 行）
export function setToken(token: string): void {
  storage.setToken(token);
}

// 替换 removeToken 函数（约第 45-48 行）
export function removeToken(): void {
  storage.removeToken();
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/storage.ts packages/web/src/lib/api.ts
git commit -m "feat: add storage utility and refactor api.ts to use it"
```

---

### Task 6: 合并 drafts-api 到 api.ts

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Delete: `packages/web/src/lib/drafts-api.ts`

- [ ] **Step 1: 在 api.ts 中添加 drafts 方法**

在 `packages/web/src/lib/api.ts` 的 `api` 对象末尾添加：

```typescript
  // Draft 相关 API（从 drafts-api.ts 合并）
  drafts: {
    create: (input: CreateDraftInput): Promise<{ draft: Draft }> =>
      apiClient<{ draft: Draft }>('/drafts', { method: 'POST', body: JSON.stringify(input) }),

    list: (projectId?: number): Promise<{ drafts: Draft[] }> =>
      apiClient<{ drafts: Draft[] }>(
        projectId ? `/drafts?projectId=${projectId}` : '/drafts',
        { method: 'GET' }
      ),

    get: (draftId: number): Promise<{ draft: Draft; members: DraftMember[] }> =>
      apiClient<{ draft: Draft; members: DraftMember[] }>(`/drafts/${draftId}`, { method: 'GET' }),

    updateStatus: (draftId: number, status: DraftStatus): Promise<{ draft: Draft }> =>
      apiClient<{ draft: Draft }>(`/drafts/${draftId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),

    delete: (draftId: number): Promise<{ success: boolean }> =>
      apiClient<{ success: boolean }>(`/drafts/${draftId}`, { method: 'DELETE' }),

    addMember: (draftId: number, userId: number): Promise<{ success: boolean }> =>
      apiClient<{ success: boolean }>(`/drafts/${draftId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),

    removeMember: (draftId: number, userId: number): Promise<{ success: boolean }> =>
      apiClient<{ success: boolean }>(`/drafts/${draftId}/members/${userId}`, { method: 'DELETE' }),

    getMessages: (
      draftId: number,
      options?: { parentId?: number; limit?: number; before?: string }
    ): Promise<{ messages: DraftMessage[] }> => {
      const params = new URLSearchParams();
      if (options?.parentId !== undefined) params.set('parentId', String(options.parentId));
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.before) params.set('before', options.before);
      const query = params.toString();
      return apiClient<{ messages: DraftMessage[] }>(
        `/drafts/${draftId}/messages${query ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    },

    sendMessage: (draftId: number, input: SendMessageInput): Promise<{ message: DraftMessage }> =>
      apiClient<{ message: DraftMessage }>(`/drafts/${draftId}/messages`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    confirmMessage: (
      draftId: number,
      messageId: number,
      type: ConfirmationType,
      comment?: string
    ): Promise<{ success: boolean }> =>
      apiClient<{ success: boolean }>(`/drafts/${draftId}/messages/${messageId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ type, comment }),
      }),

    getConfirmations: (
      draftId: number,
      messageId: number
    ): Promise<{ confirmations: Array<{ userId: number; userName: string; type: string; comment: string | null }> }> =>
      apiClient(`/drafts/${draftId}/messages/${messageId}/confirmations`, { method: 'GET' }),
  },
```

- [ ] **Step 2: 在 api.ts 顶部添加类型导入**

```typescript
import type {
  Draft,
  DraftMember,
  DraftMessage,
  CreateDraftInput,
  SendMessageInput,
  DraftStatus,
  ConfirmationType,
} from '@/types/draft';
```

- [ ] **Step 3: 查找并更新所有使用 drafts-api 的文件**

```bash
grep -r "from '@/lib/drafts-api'" packages/web/src/
```

更新导入为：
```typescript
// 原来
import { draftsApi } from '@/lib/drafts-api';

// 改为
import { api } from '@/lib/api';
// 使用 api.drafts.xxx() 代替 draftsApi.xxx()
```

- [ ] **Step 4: 删除 drafts-api.ts**

```bash
rm packages/web/src/lib/drafts-api.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: merge drafts-api into unified api client"
```

---

### Task 7: 创建统一类型定义

**Files:**
- Create: `packages/web/src/types/index.ts`
- Create: `packages/web/src/types/project.ts`
- Create: `packages/web/src/types/websocket.ts`
- Modify: `packages/web/src/types/draft.ts`

- [ ] **Step 1: 创建 project.ts**

```typescript
// src/types/project.ts
export interface Project {
  id: number;
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  createdAt: string;
}

export type TemplateType = Project['templateType'];
export type ProjectStatus = Project['status'];

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  running: 'var(--status-success)',
  stopped: 'var(--status-warning)',
  created: 'var(--text-disabled)',
};
```

- [ ] **Step 2: 创建 websocket.ts**

```typescript
// src/types/websocket.ts
export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'user_joined'
  | 'user_left'
  | 'chat'
  | 'file_change'
  | 'build_status';

export interface BaseWSMessage {
  type: string;
  timestamp: string;
}

export interface ChatWSMessage extends BaseWSMessage {
  type: 'chat';
  projectId: number;
  userId: number;
  userName: string;
  content: string;
}

export interface UserEventWSMessage extends BaseWSMessage {
  type: 'user_joined' | 'user_left';
  projectId: number;
  userId: number;
  userName: string;
}
```

- [ ] **Step 3: 更新 draft.ts 添加导出**

检查 `packages/web/src/types/draft.ts`，确保所有类型都有 export：

```typescript
// 确保这些类型导出（如果已存在则无需修改）
export type DraftStatus = 'open' | 'closed' | 'merged';
export type ConfirmationType = 'approve' | 'request_changes' | 'comment';
// ... 其他类型
```

- [ ] **Step 4: 创建 index.ts**

```typescript
// src/types/index.ts
export * from './api';
export * from './project';
export * from './draft';
export * from './websocket';
```

- [ ] **Step 5: 更新组件使用统一类型**

查找重复定义 Project 的文件：

```bash
grep -r "interface Project" packages/web/src/components/
```

更新导入：
```typescript
// 原来
interface Project { id: number; name: string; ... }

// 改为
import type { Project } from '@/types';
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/types/
git commit -m "feat: add centralized type definitions"
```

---

### Task 8: 清理旧文件

**Files:**
- Delete: `packages/web/src/lib/websocket-client.ts`
- Delete: `packages/web/src/lib/terminal-websocket.ts`
- Delete: `packages/web/src/lib/draft-websocket.ts`
- Delete: `packages/web/src/lib/use-websocket.ts`
- Modify: `packages/web/src/lib/websocket/index.ts`（确保导出正确）

- [ ] **Step 1: 查找依赖这些文件的组件**

```bash
grep -r "from '@/lib/websocket-client'" packages/web/src/
grep -r "from '@/lib/terminal-websocket'" packages/web/src/
grep -r "from '@/lib/draft-websocket'" packages/web/src/
grep -r "from '@/lib/use-websocket'" packages/web/src/
```

- [ ] **Step 2: 更新所有导入**

将所有导入更新为新路径：
```typescript
// websocket-client.ts 的使用者
import { WebSocketBase } from '@/lib/websocket';

// terminal-websocket.ts 的使用者（已在 Task 2 完成）
import { TerminalWebSocket } from '@/lib/websocket/terminal';

// draft-websocket.ts 的使用者（已在 Task 3 完成）
import { DraftWebSocket } from '@/lib/websocket/draft';
// 或使用 Hook
import { useDraftWebSocket } from '@/hooks/use-draft-websocket';
```

- [ ] **Step 3: 删除旧文件**

```bash
rm packages/web/src/lib/websocket-client.ts
rm packages/web/src/lib/terminal-websocket.ts
rm packages/web/src/lib/draft-websocket.ts
rm packages/web/src/lib/use-websocket.ts
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/web && pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove deprecated WebSocket files"
```

---

### Task 9: 移除 Tailwind 残留

**Files:**
- Modify: `packages/web/src/app/oauth/github/callback/page.tsx`
- Modify: `packages/web/src/app/oauth/gitlab/callback/page.tsx`
- Modify: `packages/web/src/components/repo-import-dialog.tsx`

- [ ] **Step 1: 查找 Tailwind 类名**

```bash
grep -rn "className=" packages/web/src/ --include="*.tsx"
```

- [ ] **Step 2: 将 Tailwind 类名改为 inline styles**

例如 OAuth 回调页面：

```typescript
// 原来
<div className="min-h-screen flex items-center justify-center bg-gray-50">

// 改为
<div style={{
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--bg-primary)',
}}>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "style: remove Tailwind remnants, use CSS variables"
```

---

### Task 10: OAuth 页面改用 async/await

**Files:**
- Modify: `packages/web/src/app/oauth/github/callback/page.tsx`
- Modify: `packages/web/src/app/oauth/gitlab/callback/page.tsx`

- [ ] **Step 1: 重构 GitHub OAuth 回调**

```typescript
// src/app/oauth/github/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

export default function GitHubOAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        setStatus('error');
        setError('缺少授权码');
        return;
      }

      try {
        const result = await api.post<{ token: string }>('/github/oauth/callback', {
          code,
          state,
        });

        storage.setToken(result.token);
        setStatus('success');

        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : '授权失败');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
    }}>
      <div style={{ textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div style={{ color: 'var(--text-secondary)' }}>正在处理 GitHub 授权...</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--status-success)' }}>✓</div>
            <div style={{ color: 'var(--text-primary)' }}>授权成功，正在跳转...</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--status-error)' }}>✕</div>
            <div style={{ color: 'var(--status-error)' }}>{error}</div>
            <button
              onClick={() => router.push('/login')}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              返回登录
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 同样重构 GitLab OAuth 回调**

类似修改 `packages/web/src/app/oauth/gitlab/callback/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/oauth/
git commit -m "refactor: OAuth callbacks use async/await pattern"
```

---

### Task 11: 全量测试验证

- [ ] **Step 1: 运行所有前端测试**

```bash
cd packages/web && pnpm test
```

Expected: PASS

- [ ] **Step 2: 运行 TypeScript 类型检查**

```bash
cd packages/web && pnpm tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: 构建验证**

```bash
cd packages/web && pnpm build
```

Expected: 成功

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify frontend architecture refactor"
```

---

## 文件变更摘要

| 操作 | 文件路径 |
|------|----------|
| Create | `packages/web/src/lib/websocket/base.ts` |
| Create | `packages/web/src/lib/websocket/terminal.ts` |
| Create | `packages/web/src/lib/websocket/draft.ts` |
| Create | `packages/web/src/lib/websocket/index.ts` |
| Create | `packages/web/src/lib/storage.ts` |
| Create | `packages/web/src/types/index.ts` |
| Create | `packages/web/src/types/project.ts` |
| Create | `packages/web/src/types/websocket.ts` |
| Create | `packages/web/src/hooks/use-draft-websocket.ts` |
| Create | `packages/web/tests/websocket-base.test.ts` |
| Modify | `packages/web/src/lib/api.ts` |
| Modify | `packages/web/src/types/draft.ts` |
| Modify | `packages/web/src/components/terminal/terminal-panel.tsx` |
| Modify | `packages/web/src/app/oauth/github/callback/page.tsx` |
| Modify | `packages/web/src/app/oauth/gitlab/callback/page.tsx` |
| Modify | `packages/web/src/components/repo-import-dialog.tsx` |
| Delete | `packages/web/src/lib/websocket-client.ts` |
| Delete | `packages/web/src/lib/terminal-websocket.ts` |
| Delete | `packages/web/src/lib/draft-websocket.ts` |
| Delete | `packages/web/src/lib/use-websocket.ts` |
| Delete | `packages/web/src/lib/drafts-api.ts` |