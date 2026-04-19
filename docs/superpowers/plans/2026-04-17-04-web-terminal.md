# Web 终端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现浏览器内终端 — 用户通过 xterm.js 连接到项目容器内的 shell，实时交互执行命令，使用 Claude Code CLI 进行 AI 辅助编码。

**Architecture:** 前端使用 xterm.js 渲染终端界面，通过 WebSocket 连接到服务端。服务端收到终端输入后，使用 Docker exec API 在容器内启动 shell 进程，将 stdin/stdout 通过 WebSocket 双向流转。支持 PTY 模式保证交互式命令正常工作。

**Tech Stack:** xterm.js + xterm-addon-fit, Docker exec API (pty=true), WebSocket 双向流

---

## 文件结构

```
packages/server/
├── src/
│   ├── terminal/
│   │   ├── terminal-manager.ts    # 终端会话管理
│   │   └── docker-exec.ts         # Docker exec 封装
│   ├── routes/
│   │   └── terminal.ts            # 终端 WebSocket 路由
│   └── index.ts                   # 挂载终端路由
├── tests/
│   └── terminal-manager.test.ts   # 终端管理测试

packages/web/
├── src/
│   ├── components/
│   │   └── terminal.tsx           # xterm.js 终端组件
│   │   └── terminal-container.tsx # 终端容器（状态管理）
│   └── lib/
│       └── terminal-websocket.ts  # 终端 WebSocket 客户端
├── tests/
│   └── terminal.test.tsx          # 终端组件测试
```

---

### Task 1: Docker Exec 封装

**Files:**
- Create: `packages/server/src/terminal/docker-exec.ts`
- Create: `packages/server/tests/docker-exec.test.ts`

- [ ] **Step 1: 写 Docker exec 测试**

```typescript
// tests/docker-exec.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createExecSession, streamExecOutput } from '../src/terminal/docker-exec.ts';
import { getDockerClient } from '../src/docker/client.ts';

describe('Docker Exec', () => {
  let testContainerId: string;

  beforeEach(async () => {
    // 创建一个临时测试容器
    const docker = getDockerClient();
    const container = await docker.createContainer({
      Image: 'node:20-slim',
      Cmd: ['tail', '-f', '/dev/null'],
    });
    testContainerId = container.id;
    await container.start();
  });

  afterEach(async () => {
    const docker = getDockerClient();
    await docker.getContainer(testContainerId).remove({ force: true });
  });

  it('should create exec instance in container', async () => {
    const exec = await createExecSession(testContainerId, ['ls', '-la']);
    expect(exec.id).toBeDefined();
  });

  it('should stream output from exec', async () => {
    const { exec, stream } = await streamExecOutput(testContainerId, ['echo', 'hello']);

    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    await new Promise<void>((resolve) => {
      stream.on('end', () => resolve());
    });

    expect(output).toContain('hello');
  });

  it('should support interactive exec with stdin', async () => {
    const { exec, stream } = await streamExecOutput(testContainerId, ['cat'], true);

    // 发送输入
    stream.write('test input\n');

    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    // 发送 EOF
    stream.end();

    await new Promise<void>((resolve) => {
      stream.on('end', () => resolve());
    });

    expect(output).toContain('test input');
  });
});
```

- [ ] **Step 2: 实现 Docker exec 封装**

```typescript
// src/terminal/docker-exec.ts
import { getDockerClient } from '../docker/client.ts';

interface ExecResult {
  exec: Docker.Exec;
  stream: NodeJS.ReadWriteStream;
}

export async function createExecSession(
  containerId: string,
  cmd: string[],
  interactive: boolean = false
): Promise<Docker.Exec> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: interactive,
    AttachStdout: true,
    AttachStderr: true,
    Tty: interactive, // PTY 模式
    Privileged: false,
    User: 'root',
  });

  return exec;
}

export async function streamExecOutput(
  containerId: string,
  cmd: string[],
  interactive: boolean = false
): Promise<ExecResult> {
  const exec = await createExecSession(containerId, cmd, interactive);
  const docker = getDockerClient();

  const stream = await exec.start({
    Detach: false,
    Tty: interactive,
    hijack: interactive, // stdin/stdout 混合模式
  });

  // 对于非交互式，解析 Docker stream 格式
  if (!interactive) {
    return { exec, stream: parseDockerStream(stream) };
  }

  return { exec, stream };
}

// 解析 Docker 多路复用流格式
// 格式: [type(1byte), 0, 0, 0, size(4bytes), payload...]
function parseDockerStream(rawStream: NodeJS.ReadableStream): NodeJS.ReadableStream {
  const { PassThrough } = require('stream');
  const parsed = new PassThrough();

  let buffer = Buffer.alloc(0);

  rawStream.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 8) {
      const type = buffer[0]; // 1=stdout, 2=stderr
      const size = buffer.readUInt32BE(4);

      if (buffer.length < 8 + size) break;

      const payload = buffer.slice(8, 8 + size);
      parsed.push(payload);

      buffer = buffer.slice(8 + size);
    }
  });

  rawStream.on('end', () => {
    parsed.end();
  });

  return parsed;
}

export async resizeExecTTY(execId: string, cols: number, rows: number): Promise<void> {
  const docker = getDockerClient();
  const exec = docker.getExec(execId);

  await exec.resize({ h: rows, w: cols });
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/docker-exec.test.ts
```

Expected: PASS（需要本地 Docker 运行）

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/terminal/docker-exec.ts packages/server/tests/docker-exec.test.ts
git commit -m "feat: add Docker exec wrapper for terminal support"
```

---

### Task 2: 终端会话管理

**Files:**
- Create: `packages/server/src/terminal/terminal-manager.ts`
- Create: `packages/server/tests/terminal-manager.test.ts`

- [ ] **Step 1: 写终端管理测试**

```typescript
// tests/terminal-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalManager } from '../src/terminal/terminal-manager.ts';
import { EventEmitter } from 'events';

describe('TerminalManager', () => {
  let manager: TerminalManager;
  let mockContainerId: string;

  beforeEach(() => {
    manager = new TerminalManager();
    mockContainerId = 'test-container-id';
  });

  afterEach(() => {
    manager.closeAll();
  });

  it('should create terminal session', () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();

    const sessionId = manager.createSession(mockContainerId, mockWs, 80, 24);
    expect(sessionId).toBeDefined();
    expect(manager.getSessionCount()).toBe(1);
  });

  it('should close terminal session', () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();

    const sessionId = manager.createSession(mockContainerId, mockWs, 80, 24);
    manager.closeSession(sessionId);

    expect(manager.getSessionCount()).toBe(0);
  });

  it('should handle terminal input', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();

    // 创建测试容器并启动 shell
    const docker = getDockerClient();
    const container = await docker.createContainer({
      Image: 'node:20-slim',
      Cmd: ['tail', '-f', '/dev/null'],
    });
    mockContainerId = container.id;
    await container.start();

    const sessionId = manager.createSession(mockContainerId, mockWs, 80, 24);

    // 模拟输入
    mockWs.emit('message', JSON.stringify({ type: 'input', data: 'ls\n' }));

    // 等待输出
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    // 检查是否收到输出
    expect(mockWs.send).toHaveBeenCalled();

    // 清理
    await container.remove({ force: true });
  });

  it('should resize terminal', () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();

    const sessionId = manager.createSession(mockContainerId, mockWs, 80, 24);
    manager.resize(sessionId, 120, 40);

    // 验证 resize 被调用（实际验证需要真实容器）
    expect(manager.getSession(sessionId)).toBeDefined();
  });
});
```

- [ ] **Step 2: 实现终端管理器**

```typescript
// src/terminal/terminal-manager.ts
import WebSocket from 'ws';
import { streamExecOutput, resizeExecTTY, createExecSession } from './docker-exec.ts';
import { EventEmitter } from 'events';

interface TerminalSession {
  id: string;
  containerId: string;
  ws: WebSocket;
  execId: string;
  stream: NodeJS.ReadWriteStream;
  cols: number;
  rows: number;
}

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionCounter = 0;

  async createSession(
    containerId: string,
    ws: WebSocket,
    cols: number = 80,
    rows: number = 24
  ): Promise<string> {
    const sessionId = `terminal-${++this.sessionCounter}`;

    // 启动 bash shell
    const { exec, stream } = await streamExecOutput(
      containerId,
      ['bash', '-l'],
      true // interactive mode
    );

    const session: TerminalSession = {
      id: sessionId,
      containerId,
      ws,
      execId: exec.id,
      stream,
      cols,
      rows,
    };

    // 设置初始终端大小
    await resizeExecTTY(exec.id, cols, rows);

    // 监听容器输出，转发到 WebSocket
    stream.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          data: data.toString('base64'),
        }));
      }
    });

    stream.on('end', () => {
      ws.send(JSON.stringify({ type: 'exit' }));
      this.closeSession(sessionId);
    });

    stream.on('error', (error) => {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
      this.closeSession(sessionId);
    });

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  handleInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // 解码 base64 输入
    const buffer = Buffer.from(data, 'base64');
    session.stream.write(buffer);
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.cols = cols;
    session.rows = rows;

    await resizeExecTTY(session.execId, cols, rows);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.stream.end();
    session.ws.close();

    this.sessions.delete(sessionId);
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
    return Array.from(this.sessions.values()).filter(
      (s) => s.containerId === containerId
    );
  }
}

// 全局单例
let terminalManagerInstance: TerminalManager | null = null;

export function getTerminalManager(): TerminalManager {
  if (!terminalManagerInstance) {
    terminalManagerInstance = new TerminalManager();
  }
  return terminalManagerInstance;
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/terminal-manager.test.ts
```

Expected: PASS（需要本地 Docker 运行）

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/terminal/terminal-manager.ts packages/server/tests/terminal-manager.test.ts
git commit -m "feat: add terminal session manager"
```

---

### Task 3: 终端 WebSocket 路由

**Files:**
- Create: `packages/server/src/routes/terminal.ts`
- Modify: `packages/server/src/websocket/server.ts`

- [ ] **Step 1: 实现终端 WebSocket 处理器**

```typescript
// src/routes/terminal.ts
import WebSocket from 'ws';
import { getTerminalManager } from '../terminal/terminal-manager.ts';
import { authMiddleware } from '../middleware/auth.ts';
import type Database from 'better-sqlite3';

interface TerminalMessage {
  type: 'input' | 'resize' | 'ping';
  sessionId?: string;
  data?: string;
  cols?: number;
  rows?: number;
}

export function handleTerminalConnection(
  ws: WebSocket,
  projectId: number,
  userId: number,
  db: Database.Database
): void {
  // 检查项目存在性和权限
  const project = db
    .prepare('SELECT container_id FROM projects WHERE id = ?')
    .get(projectId);

  if (!project || !project.container_id) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '项目容器未启动',
    }));
    ws.close();
    return;
  }

  const membership = db
    .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);

  if (!membership) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '无权限访问此项目',
    }));
    ws.close();
    return;
  }

  const manager = getTerminalManager();
  let sessionId: string | null = null;

  ws.on('message', async (raw: Buffer) => {
    try {
      const msg: TerminalMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'start':
          // 创建终端会话
          sessionId = await manager.createSession(
            project.container_id,
            ws,
            msg.cols || 80,
            msg.rows || 24
          );
          ws.send(JSON.stringify({
            type: 'started',
            sessionId,
          }));
          break;

        case 'input':
          if (sessionId && msg.data) {
            manager.handleInput(sessionId, msg.data);
          }
          break;

        case 'resize':
          if (sessionId && msg.cols && msg.rows) {
            await manager.resize(sessionId, msg.cols, msg.rows);
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '无效的消息格式',
      }));
    }
  });

  ws.on('close', () => {
    if (sessionId) {
      manager.closeSession(sessionId);
    }
  });
}
```

- [ ] **Step 2: 在 WebSocket 服务器中集成终端路由**

```typescript
// src/websocket/server.ts - 修改 setupHandlers 方法
import { handleTerminalConnection } from '../routes/terminal.ts';
import type Database from 'better-sqlite3';

// 在 WebSocketServer 类中添加 db 依赖
private db: Database.Database;

constructor(server: HttpServer, db: Database.Database) {
  this.wss = new WSServer({ server });
  this.db = db;
  this.channels = new ChannelManager();
  this.setupHandlers();
}

private setupHandlers(): void {
  this.wss.on('connection', (ws, req) => {
    const url = req.url || '';

    // 根据路径区分不同类型的 WebSocket 连接
    if (url.startsWith('/terminal')) {
      // 终端连接：解析 URL 参数
      const params = new URLSearchParams(url.split('?')[1]);
      const projectId = parseInt(params.get('projectId') || '0', 10);
      const userId = parseInt(params.get('userId') || '0', 10);

      if (projectId && userId) {
        handleTerminalConnection(ws, projectId, userId, this.db);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: '缺少 projectId 或 userId' }));
        ws.close();
      }
    } else {
      // 普通实时同步连接
      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
    }
  });
}
```

- [ ] **Step 3: 更新 WebSocket 服务器初始化**

```typescript
// src/index.ts - 修改 startServer
export function startServer(db: Database.Database, port: number = 3001): void {
  const app = createApp(db);
  const server = createServer(app);

  // 初始化 WebSocket 服务器（传入 db）
  createWebSocketServer(server, db);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/terminal.ts packages/server/src/websocket/server.ts packages/server/src/index.ts
git commit -m "feat: add terminal WebSocket route"
```

---

### Task 4: 前端 xterm.js 组件

**Files:**
- Create: `packages/web/src/components/terminal.tsx`
- Create: `packages/web/src/components/terminal-container.tsx`
- Create: `packages/web/src/lib/terminal-websocket.ts`
- Modify: `packages/web/package.json`

- [ ] **Step 1: 添加 xterm.js 依赖**

```bash
cd packages/web && pnpm add xterm xterm-addon-fit xterm-addon-web-links
```

- [ ] **Step 2: 实现终端 WebSocket 客户端**

```typescript
// src/lib/terminal-websocket.ts
export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private onOutput: ((data: string) => void) | null = null;
  private onExit: (() => void) | null = null;

  connect(url: string, projectId: number, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${url}/terminal?projectId=${projectId}&userId=${userId}`);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'started':
            this.sessionId = msg.sessionId;
            break;

          case 'output':
            if (this.onOutput && msg.data) {
              // 解码 base64 输出
              const decoded = atob(msg.data);
              this.onOutput(decoded);
            }
            break;

          case 'exit':
            if (this.onExit) {
              this.onExit();
            }
            this.disconnect();
            break;

          case 'error':
            console.error('Terminal error:', msg.message);
            break;
        }
      };
    });
  }

  start(cols: number, rows: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'start',
        cols,
        rows,
      }));
    }
  }

  sendInput(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // 编码为 base64
      const encoded = btoa(data);
      this.ws.send(JSON.stringify({
        type: 'input',
        sessionId: this.sessionId,
        data: encoded,
      }));
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'resize',
        sessionId: this.sessionId,
        cols,
        rows,
      }));
    }
  }

  setOnOutput(handler: (data: string) => void): void {
    this.onOutput = handler;
  }

  setOnExit(handler: () => void): void {
    this.onExit = handler;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 3: 实现终端组件**

```typescript
// src/components/terminal.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalProps {
  projectId: number;
  userId: number;
  wsUrl?: string;
}

export function Terminal({ projectId, userId, wsUrl }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const wsUrlFinal = wsUrl || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

  useEffect(() => {
    if (!terminalRef.current) return;

    // 创建 xterm 实例
    const xterm = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
      },
    });

    xtermRef.current = xterm;

    // 添加 fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // 添加 web links addon
    xterm.loadAddon(new WebLinksAddon());

    // 打开终端
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // 连接 WebSocket
    const ws = new TerminalWebSocket();
    wsRef.current = ws;

    ws.connect(wsUrlFinal, projectId, userId)
      .then(() => {
        // 启动终端会话
        ws.start(xterm.cols, xterm.rows);

        // 设置输出处理器
        ws.setOnOutput((data) => {
          xterm.write(data);
        });

        ws.setOnExit(() => {
          xterm.write('\r\n\x1b[31m[终端已关闭]\x1b[0m\r\n');
        });

        // 监听终端输入
        xterm.onData((data) => {
          ws.sendInput(data);
        });

        // 监听终端大小变化
        xterm.onResize(({ cols, rows }) => {
          ws.resize(cols, rows);
        });
      })
      .catch((error) => {
        xterm.write(`\r\n\x1b[31m连接失败: ${error.message}\x1b[0m\r\n`);
      });

    // 窗口 resize 时调整终端大小
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.disconnect();
      xterm.dispose();
    };
  }, [projectId, userId, wsUrlFinal]);

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1e1e1e',
        padding: '8px',
      }}
    />
  );
}
```

- [ ] **Step 4: 实现终端容器组件**

```typescript
// src/components/terminal-container.tsx
'use client';

import { useState } from 'react';
import { Terminal } from './terminal';

interface TerminalContainerProps {
  projectId: number;
  userId: number;
}

export function TerminalContainer({ projectId, userId }: TerminalContainerProps) {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(400);

  if (!isTerminalOpen) {
    return (
      <button
        onClick={() => setIsTerminalOpen(true)}
        className="btn btn-primary"
      >
        打开终端
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #3d3d3d',
      }}>
        <span style={{ color: '#cccccc', fontSize: '14px' }}>
          Web 终端
        </span>
        <button
          onClick={() => setIsTerminalOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cccccc',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{
        height: `${terminalHeight}px`,
        resize: 'vertical',
        overflow: 'hidden',
      }}>
        <Terminal projectId={projectId} userId={userId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal.tsx packages/web/src/components/terminal-container.tsx packages/web/src/lib/terminal-websocket.ts packages/web/package.json
git commit -m "feat: add xterm.js terminal component"
```

---

### Task 5: 全量测试 + 端到端验证

**Files:**
- None (测试现有功能)

- [ ] **Step 1: 运行所有测试**

```bash
cd packages/server && pnpm test
cd packages/web && pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 2: 手动验证完整流程**

```bash
# 启动服务
cd packages/server && pnpm dev

# 创建项目并启动容器（使用之前的 API）

# 在浏览器中打开项目页面，点击"打开终端"按钮
# 验证终端显示 bash shell 提示符
# 在终端中执行命令：ls, pwd, echo "hello"
# 验证终端窗口 resize 功能
```

Expected: 终端正常工作，可以执行交互式命令

- [ ] **Step 3: 测试 Claude Code CLI**

```bash
# 在终端中执行 Claude Code CLI 命令
claude

# 验证 Claude Code 交互界面正常显示
# 测试 AI 辅助编码功能
```

Expected: Claude Code CLI 在终端中正常工作

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify Web terminal end-to-end"
```