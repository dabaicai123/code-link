// tests/terminal-manager.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { getDockerClient } from '../src/docker/client.ts';
import { getTerminalManager, resetTerminalManagerInstance } from '../src/terminal/terminal-manager.ts';

// 使用可用的镜像
const TEST_IMAGE = 'node:22-slim';
const TEST_CONTAINER_NAME = 'code-link-test-terminal-manager';

// 创建 mock WebSocket
function createMockWebSocket(): WebSocket {
  const ws = {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return ws as unknown as WebSocket;
}

describe('Terminal Manager', () => {
  let sharedContainerId: string | null = null;
  const docker = getDockerClient();

  // 所有测试前创建一个共享容器
  beforeAll(async () => {
    // 检查镜像是否存在，不存在则拉取
    try {
      await docker.getImage(TEST_IMAGE).inspect();
    } catch {
      // 镜像不存在，拉取
      await new Promise<void>((resolve, reject) => {
        docker.pull(TEST_IMAGE, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }

    // 检查是否已存在同名容器，避免重复创建
    try {
      const existingContainer = docker.getContainer(TEST_CONTAINER_NAME);
      const info = await existingContainer.inspect();
      sharedContainerId = info.Id;
      // 确保容器正在运行
      if (info.State.Status !== 'running') {
        await existingContainer.start();
      }
    } catch {
      // 不存在，创建新容器
      const container = await docker.createContainer({
        name: TEST_CONTAINER_NAME,
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      sharedContainerId = container.id;
      await container.start();
    }
  }, 60000);

  // 所有测试后清理共享容器
  afterAll(async () => {
    // 先关闭所有终端会话
    const manager = getTerminalManager();
    manager.closeAll();
    resetTerminalManagerInstance();

    // 清理共享容器
    if (sharedContainerId) {
      try {
        await docker.getContainer(sharedContainerId).remove({ force: true });
      } catch {
        // 容器可能已不存在
      }
      sharedContainerId = null;
    }
  }, 15000);

  beforeEach(() => {
    // 重置 TerminalManager 实例
    resetTerminalManagerInstance();
  });

  afterEach(() => {
    // 每个测试后关闭所有会话，避免状态污染
    const manager = getTerminalManager();
    manager.closeAll();
  });

  describe('createSession', () => {
    it('should create a terminal session', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(sharedContainerId!, ws, 120, 40);

      expect(sessionId).toBeDefined();
      expect(sessionId.startsWith('term-')).toBe(true);
      expect(manager.getSessionCount()).toBe(1);

      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.containerId).toBe(sharedContainerId);
      expect(session?.cols).toBe(120);
      expect(session?.rows).toBe(40);
    });

    it('should send error message when container does not exist', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();

      await expect(
        manager.createSession('nonexistent-container-id-12345', ws, 80, 24)
      ).rejects.toThrow();

      // 应该发送错误消息
      expect(ws.send).toHaveBeenCalled();
      const calls = (ws.send as any).mock.calls;
      const errorMessages = calls.filter((call: any[]) => {
        const msg = JSON.parse(call[0]);
        return msg.type === 'error';
      });
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('closeSession', () => {
    it('should close a session and remove it from map', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(sharedContainerId!, ws);

      expect(manager.getSessionCount()).toBe(1);

      manager.closeSession(sessionId);

      expect(manager.getSessionCount()).toBe(0);
      expect(manager.getSession(sessionId)).toBeUndefined();
    });

    it('should handle closing non-existent session gracefully', () => {
      const manager = getTerminalManager();
      // 不应该抛出错误
      expect(() => manager.closeSession('non-existent-session')).not.toThrow();
    });
  });

  describe('closeAll', () => {
    it('should close all sessions', async () => {
      const manager = getTerminalManager();

      // 创建多个会话
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      await manager.createSession(sharedContainerId!, ws1);
      await manager.createSession(sharedContainerId!, ws2);

      expect(manager.getSessionCount()).toBe(2);

      manager.closeAll();

      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct session count', async () => {
      const manager = getTerminalManager();
      expect(manager.getSessionCount()).toBe(0);

      const ws = createMockWebSocket();
      await manager.createSession(sharedContainerId!, ws);
      expect(manager.getSessionCount()).toBe(1);

      manager.closeAll();
      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('getSessionsByContainer', () => {
    it('should return all sessions for a container', async () => {
      const manager = getTerminalManager();

      // 为容器创建多个会话
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      await manager.createSession(sharedContainerId!, ws1);
      await manager.createSession(sharedContainerId!, ws2);

      const containerSessions = manager.getSessionsByContainer(sharedContainerId!);
      expect(containerSessions.length).toBe(2);

      manager.closeAll();
    });

    it('should return empty array for container with no sessions', () => {
      const manager = getTerminalManager();
      const sessions = manager.getSessionsByContainer('non-existent-container');
      expect(sessions).toEqual([]);
    });
  });

  describe('handleInput', () => {
    it('should handle input for a session', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(sharedContainerId!, ws);

      // 发送 "ls" 命令 (base64 编码)
      const inputData = Buffer.from('ls\n').toString('base64');
      expect(() => manager.handleInput(sessionId, inputData)).not.toThrow();
    });

    it('should handle input for non-existent session gracefully', () => {
      const manager = getTerminalManager();
      const inputData = Buffer.from('test').toString('base64');
      expect(() => manager.handleInput('non-existent-session', inputData)).not.toThrow();
    });
  });

  describe('resize', () => {
    it('should resize terminal', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(sharedContainerId!, ws, 80, 24);

      await manager.resize(sessionId, 120, 40);

      const session = manager.getSession(sessionId);
      expect(session?.cols).toBe(120);
      expect(session?.rows).toBe(40);
    });

    it('should handle resize for non-existent session gracefully', async () => {
      const manager = getTerminalManager();
      // 不应该抛出错误
      await expect(manager.resize('non-existent-session', 80, 24)).resolves.not.toThrow();
    });
  });

  describe('WebSocket integration', () => {
    it('should send output to WebSocket when shell produces output', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      await manager.createSession(sharedContainerId!, ws);

      // 发送一个简单的命令
      const session = manager.getSessionsByContainer(sharedContainerId!)[0];
      const inputData = Buffer.from('echo "test"\n').toString('base64');
      manager.handleInput(session.id, inputData);

      // 等待输出
      await new Promise(resolve => setTimeout(resolve, 500));

      // 验证 WebSocket send 被调用（输出会被发送）
      expect(ws.send).toHaveBeenCalled();
    });

    it('should send exit message when shell exits', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(sharedContainerId!, ws);

      // 发送 exit 命令
      const inputData = Buffer.from('exit\n').toString('base64');
      manager.handleInput(sessionId, inputData);

      // 等待 shell 退出
      await new Promise(resolve => setTimeout(resolve, 500));

      // 验证会话已关闭或 exit 消息被发送
      // shell 退出后，会话应该从 sessions map 中删除
      // 或者 stream 结束时会发送 exit 消息
      const session = manager.getSession(sessionId);

      // 检查是否发送了 exit 消息或会话被删除
      const calls = (ws.send as any).mock.calls;
      const exitMessages = calls.filter((call: any[]) => {
        const msg = JSON.parse(call[0]);
        return msg.type === 'exit';
      });

      // 要么会话已删除，要么发送了 exit 消息
      const sessionClosed = session === undefined;
      const exitMessageSent = exitMessages.length > 0;

      expect(sessionClosed || exitMessageSent).toBe(true);
    });
  });

  describe('Terminal session properties', () => {
    it('should have correct session metadata', async () => {
      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const beforeCreate = new Date();
      const sessionId = await manager.createSession(sharedContainerId!, ws, 100, 30);
      const afterCreate = new Date();

      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.containerId).toBe(sharedContainerId);
      expect(session?.ws).toBe(ws);
      expect(session?.cols).toBe(100);
      expect(session?.rows).toBe(30);
      expect(session?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(session?.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(session?.execSession).toBeDefined();
      expect(session?.execSession.exec).toBeDefined();
      expect(session?.execSession.execId).toBeDefined();
      expect(session?.execSession.stream).toBeDefined();
    });
  });
});
