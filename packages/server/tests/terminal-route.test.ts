// tests/terminal-route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import Database from 'better-sqlite3';
import { createWebSocketServer, WebSocketServer, resetWebSocketServerInstance } from '../src/websocket/server.ts';
import { getDb, closeDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import { resetTerminalManagerInstance, getTerminalManager } from '../src/terminal/terminal-manager.ts';

// Mock Docker 相关模块
vi.mock('../src/docker/container-manager.js', () => ({
  getContainerStatus: vi.fn(),
}));

vi.mock('../src/terminal/docker-exec.js', () => ({
  streamExecOutput: vi.fn(),
  resizeExecTTY: vi.fn(),
  writeToExecStream: vi.fn(),
  closeExecStdin: vi.fn(),
}));

import { getContainerStatus } from '../src/docker/container-manager.js';
import { streamExecOutput, resizeExecTTY } from '../src/terminal/docker-exec.js';

describe('Terminal WebSocket Route', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let db: Database.Database;
  let port: number;
  let testUserId: number;
  let testProjectId: number;

  beforeEach(async () => {
    // 创建内存数据库
    db = getDb(':memory:');
    initSchema(db);

    // 创建测试用户
    const userResult = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('测试用户', 'test@test.com', 'hash123');
    testUserId = userResult.lastInsertRowid as number;

    // 创建测试项目
    const projectResult = db
      .prepare('INSERT INTO projects (name, template_type, status, created_by) VALUES (?, ?, ?, ?)')
      .run('测试项目', 'node', 'running', testUserId);
    testProjectId = projectResult.lastInsertRowid as number;

    // 添加用户为项目成员
    db
      .prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(testProjectId, testUserId, 'owner');

    // 创建 HTTP 服务器
    httpServer = createServer();
    wsServer = createWebSocketServer(httpServer, db);

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
    resetWebSocketServerInstance();
    resetTerminalManagerInstance();
    closeDb(db);
  });

  describe('连接验证', () => {
    it('应拒绝缺少参数的连接', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal`);

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('缺少');

      // 等待连接关闭
      await new Promise<void>((resolve) => {
        client.on('close', () => resolve());
      });
    });

    it('应拒绝无效的项目 ID', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=invalid&userId=${testUserId}`);

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('无效');

      await new Promise<void>((resolve) => {
        client.on('close', () => resolve());
      });
    });

    it('应拒绝无效的用户 ID', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=invalid`);

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('无效');

      await new Promise<void>((resolve) => {
        client.on('close', () => resolve());
      });
    });
  });

  describe('消息处理', () => {
    it('应响应 ping 消息', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'ping' }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('pong');
      client.close();
    });

    it('应拒绝未知消息类型', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'unknown' }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('未知');
      client.close();
    });

    it('应拒绝无效的 JSON 消息', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send('not a valid json');

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('无效');
      client.close();
    });
  });

  describe('权限检查', () => {
    it('应拒绝非项目成员的访问', async () => {
      // 创建另一个用户
      const otherUserResult = db
        .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        .run('其他用户', 'other@test.com', 'hash');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${otherUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      // 尝试启动终端
      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('不存在');
      client.close();
    });

    it('应拒绝不存在的项目', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=99999&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('不存在');
      client.close();
    });
  });

  describe('start 消息', () => {
    it('应拒绝没有容器的项目', async () => {
      // 更新项目状态，移除容器
      db.prepare('UPDATE projects SET container_id = NULL WHERE id = ?').run(testProjectId);

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('没有关联的容器');
      client.close();
    });

    it('应拒绝容器未运行的项目', async () => {
      // 设置容器 ID
      db.prepare('UPDATE projects SET container_id = ? WHERE id = ?').run('test-container-id', testProjectId);

      // Mock 容器状态为非运行中
      vi.mocked(getContainerStatus).mockResolvedValue('exited');

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('容器未运行');
      client.close();
    });

    it('应成功启动终端会话', async () => {
      // 设置容器 ID
      db.prepare('UPDATE projects SET container_id = ? WHERE id = ?').run('test-container-id', testProjectId);

      // Mock 容器状态为运行中
      vi.mocked(getContainerStatus).mockResolvedValue('running');

      // Mock exec stream
      const mockStream = {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        removeAllListeners: vi.fn(),
      };
      vi.mocked(streamExecOutput).mockResolvedValue({
        stream: mockStream as any,
        exec: { id: 'test-exec' } as any,
      });

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('started');
      expect(message.sessionId).toBeDefined();
      expect(streamExecOutput).toHaveBeenCalledWith(
        'test-container-id',
        ['/bin/sh', '-c', 'exec bash || exec sh'],
        true,
        { env: ['TERM=xterm-256color'] }
      );
      client.close();
    });
  });

  describe('input 消息', () => {
    it('应拒绝未启动会话的输入', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'input', sessionId: 'test-session', data: 'dGVzdA==' }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('未启动');
      client.close();
    });

    it('应拒绝会话 ID 不匹配的输入', async () => {
      // 设置容器并启动会话
      db.prepare('UPDATE projects SET container_id = ? WHERE id = ?').run('test-container-id', testProjectId);
      vi.mocked(getContainerStatus).mockResolvedValue('running');
      const mockStream = {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        removeAllListeners: vi.fn(),
      };
      vi.mocked(streamExecOutput).mockResolvedValue({
        stream: mockStream as any,
        exec: { id: 'test-exec' } as any,
      });

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      // 先启动会话
      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const startMessage = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(startMessage.type).toBe('started');

      // 发送不匹配的 sessionId
      client.send(JSON.stringify({ type: 'input', sessionId: 'wrong-session-id', data: 'dGVzdA==' }));

      const errorMessage = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(errorMessage.type).toBe('error');
      expect(errorMessage.message).toContain('不匹配');
      client.close();
    });
  });

  describe('resize 消息', () => {
    it('应拒绝未启动会话的调整大小', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      client.send(JSON.stringify({ type: 'resize', sessionId: 'test-session', cols: 120, rows: 40 }));

      const message = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message.type).toBe('error');
      expect(message.message).toContain('未启动');
      client.close();
    });

    it('应成功调整终端大小', async () => {
      // 设置容器并启动会话
      db.prepare('UPDATE projects SET container_id = ? WHERE id = ?').run('test-container-id', testProjectId);
      vi.mocked(getContainerStatus).mockResolvedValue('running');
      const mockStream = {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        removeAllListeners: vi.fn(),
      };
      vi.mocked(streamExecOutput).mockResolvedValue({
        stream: mockStream as any,
        exec: { id: 'test-exec' } as any,
      });
      vi.mocked(resizeExecTTY).mockResolvedValue();

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      // 先启动会话
      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const startMessage = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(startMessage.type).toBe('started');
      const sessionId = startMessage.sessionId;

      // 调整大小
      client.send(JSON.stringify({ type: 'resize', sessionId, cols: 120, rows: 40 }));

      // 等待一段时间确保没有错误响应
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      expect(resizeExecTTY).toHaveBeenCalledWith({ id: 'test-exec' }, 120, 40);
      client.close();
    });
  });
});
