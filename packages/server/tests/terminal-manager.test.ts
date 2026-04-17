// tests/terminal-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { createServer } from 'http';
import { getDockerClient } from '../src/docker/client.ts';
import { getTerminalManager, resetTerminalManagerInstance } from '../src/terminal/terminal-manager.ts';

// 使用可用的镜像
const TEST_IMAGE = 'node:22-slim';

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
  let containerId: string | null = null;
  const docker = getDockerClient();

  beforeEach(async () => {
    // 重置 TerminalManager 实例
    resetTerminalManagerInstance();
  });

  afterEach(async () => {
    // 清理会话
    const manager = getTerminalManager();
    manager.closeAll();
    resetTerminalManagerInstance();

    // 清理测试容器
    if (containerId) {
      try {
        await docker.getContainer(containerId).remove({ force: true });
      } catch {
        // 容器可能已不存在
      }
      containerId = null;
    }
  });

  describe('createSession', () => {
    it('should create a terminal session', async () => {
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(containerId, ws, 120, 40);

      expect(sessionId).toBeDefined();
      expect(sessionId.startsWith('term-')).toBe(true);
      expect(manager.getSessionCount()).toBe(1);

      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.containerId).toBe(containerId);
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
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(containerId, ws);

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
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const manager = getTerminalManager();

      // 创建多个会话
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      await manager.createSession(containerId, ws1);
      await manager.createSession(containerId, ws2);

      expect(manager.getSessionCount()).toBe(2);

      manager.closeAll();

      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct session count', async () => {
      const manager = getTerminalManager();
      expect(manager.getSessionCount()).toBe(0);

      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      await manager.createSession(containerId, ws);
      expect(manager.getSessionCount()).toBe(1);

      manager.closeAll();
      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('getSessionsByContainer', () => {
    it('should return all sessions for a container', async () => {
      // 创建两个测试容器
      const container1 = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      const container1Id = container1.id;
      await container1.start();

      const container2 = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      const container2Id = container2.id;
      await container2.start();

      containerId = container1Id; // 保存一个用于 cleanup

      const manager = getTerminalManager();

      // 为每个容器创建会话
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const ws3 = createMockWebSocket();

      await manager.createSession(container1Id, ws1);
      await manager.createSession(container1Id, ws2);
      await manager.createSession(container2Id, ws3);

      const container1Sessions = manager.getSessionsByContainer(container1Id);
      expect(container1Sessions.length).toBe(2);

      const container2Sessions = manager.getSessionsByContainer(container2Id);
      expect(container2Sessions.length).toBe(1);

      // 清理第二个容器
      manager.closeAll();
      try {
        await docker.getContainer(container2Id).remove({ force: true });
      } catch {}
    });

    it('should return empty array for container with no sessions', () => {
      const manager = getTerminalManager();
      const sessions = manager.getSessionsByContainer('non-existent-container');
      expect(sessions).toEqual([]);
    });
  });

  describe('handleInput', () => {
    it('should handle input for a session', async () => {
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(containerId, ws);

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
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(containerId, ws, 80, 24);

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
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      await manager.createSession(containerId, ws);

      // 发送一个简单的命令
      const session = manager.getSessionsByContainer(containerId)[0];
      const inputData = Buffer.from('echo "test"\n').toString('base64');
      manager.handleInput(session.id, inputData);

      // 等待输出
      await new Promise(resolve => setTimeout(resolve, 500));

      // 验证 WebSocket send 被调用（输出会被发送）
      expect(ws.send).toHaveBeenCalled();
    });

    it('should send exit message when shell exits', async () => {
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const sessionId = await manager.createSession(containerId, ws);

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
      // 创建测试容器
      const container = await docker.createContainer({
        Image: TEST_IMAGE,
        Cmd: ['sleep', 'infinity'],
        Tty: false,
      });
      containerId = container.id;
      await container.start();

      const ws = createMockWebSocket();
      const manager = getTerminalManager();
      const beforeCreate = new Date();
      const sessionId = await manager.createSession(containerId, ws, 100, 30);
      const afterCreate = new Date();

      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.containerId).toBe(containerId);
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