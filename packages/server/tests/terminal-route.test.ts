// tests/terminal-route.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import Database from 'better-sqlite3';
import { createWebSocketServer, WebSocketServer, resetWebSocketServerInstance } from '../src/websocket/server.ts';
import { getSqliteDb, closeDb, initSchema } from '../src/db/index.ts';
import { resetTerminalManagerInstance, getTerminalManager } from '../src/terminal/terminal-manager.ts';
import { getDockerClient } from '../src/docker/client.ts';
import { setEncryptionKey, encrypt } from '../src/crypto/aes.ts';

// 使用固定的测试加密密钥
const TEST_ENCRYPTION_KEY = 'test-encryption-key-32-characters!';

const TEST_PROJECT_ID = 9998;
const TEST_VOLUME_PATH = '/tmp/test-volume-route';

// Mock container-manager 函数
vi.mock('../src/docker/container-manager.ts', () => ({
  createProjectContainer: vi.fn(() => Promise.resolve('mock-container-id-12345')),
  startContainer: vi.fn(() => Promise.resolve()),
  removeContainer: vi.fn(() => Promise.resolve()),
  getContainerStatus: vi.fn(() => Promise.resolve('running')),
}));

// Mock terminal-manager 的 createSession
vi.mock('../src/terminal/terminal-manager.ts', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    getTerminalManager: vi.fn(() => ({
      createSession: vi.fn(() => Promise.resolve('mock-session-id-12345')),
      closeSession: vi.fn(),
      closeAll: vi.fn(),
      getSession: vi.fn(),
      getSessionCount: vi.fn(() => 0),
      getSessionsByContainer: vi.fn(() => []),
      handleInput: vi.fn(),
      resize: vi.fn(() => Promise.resolve()),
    })),
    resetTerminalManagerInstance: original.resetTerminalManagerInstance,
  };
});

describe('Terminal WebSocket Route', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let db: Database.Database;
  let port: number;
  let testUserId: number;
  let testProjectId: number;
  let testOrgId: number;
  let sharedContainerId: string | null = null;
  const docker = getDockerClient();

  // 所有测试前创建共享容器（使用 mock）
  beforeAll(async () => {
    sharedContainerId = 'mock-container-id-12345';
  }, 10000);

  // 所有测试后清理共享容器（使用 mock）
  afterAll(async () => {
    sharedContainerId = null;
  }, 5000);

  beforeEach(async () => {
    // 设置加密密钥（测试用）- 必须在 encrypt 调用前设置
    setEncryptionKey(TEST_ENCRYPTION_KEY);

    // 关闭现有数据库连接，重置单例
    closeDb();
    // 创建内存数据库
    db = getSqliteDb(':memory:');
    initSchema(db);

    // 创建测试用户
    const userResult = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('测试用户', 'test@test.com', 'hash123');
    testUserId = userResult.lastInsertRowid as number;

    // 创建测试组织
    const orgResult = db
      .prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)')
      .run('测试组织', testUserId);
    testOrgId = orgResult.lastInsertRowid as number;

    // 添加用户为组织成员
    db
      .prepare('INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)')
      .run(testOrgId, testUserId, 'owner', testUserId);

    // 添加用户的 Claude 配置（加密存储）
    const config = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'test-token-for-terminal',
      },
    };
    const encryptedConfig = encrypt(JSON.stringify(config));
    db
      .prepare('INSERT INTO user_claude_configs (user_id, config) VALUES (?, ?)')
      .run(testUserId, encryptedConfig);

    // 创建测试项目，关联共享容器和组织
    const projectResult = db
      .prepare('INSERT INTO projects (name, template_type, status, created_by, container_id, organization_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('测试项目', 'node', 'running', testUserId, sharedContainerId, testOrgId);
    testProjectId = projectResult.lastInsertRowid as number;

    // 创建 HTTP 服务器
    httpServer = createServer();
    wsServer = createWebSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });

    // 重置 TerminalManager
    resetTerminalManagerInstance();
  });

  afterEach(() => {
    // 关闭所有终端会话
    getTerminalManager().closeAll();
    resetTerminalManagerInstance();

    if (wsServer) {
      wsServer.close();
    }
    if (httpServer) {
      httpServer.close();
    }
    resetWebSocketServerInstance();
    closeDb();
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
      // 创建一个没有容器的新项目
      const noContainerProject = db
        .prepare('INSERT INTO projects (name, template_type, status, created_by, organization_id) VALUES (?, ?, ?, ?, ?)')
        .run('无容器项目', 'node', 'created', testUserId, testOrgId);
      const noContainerProjectId = noContainerProject.lastInsertRowid as number;

      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${noContainerProjectId}&userId=${testUserId}`);

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

    it('应成功启动终端会话', async () => {
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
      client.close();
    }, 10000);
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

    it('应成功发送输入到终端', async () => {
      const client = new WebSocket(`ws://localhost:${port}/terminal?projectId=${testProjectId}&userId=${testUserId}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve());
      });

      // 启动会话
      client.send(JSON.stringify({ type: 'start', cols: 80, rows: 24 }));

      const startMessage = await new Promise<any>((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(startMessage.type).toBe('started');
      const sessionId = startMessage.sessionId;

      // 发送输入
      const inputData = Buffer.from('echo test\n').toString('base64');
      client.send(JSON.stringify({ type: 'input', sessionId, data: inputData }));

      // 等待一段时间，不应该收到错误
      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      client.close();
    }, 10000);
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
      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      client.close();
    }, 10000);
  });
});