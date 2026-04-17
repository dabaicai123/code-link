import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalWebSocket } from '../src/lib/terminal-websocket';

describe('TerminalWebSocket', () => {
  let client: TerminalWebSocket;
  const mockUrl = 'ws://localhost:3001/terminal';
  let mockWs: any;

  beforeEach(() => {
    // 创建模拟 WebSocket
    mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      onopen: null as any,
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
    };

    const MockWebSocket = vi.fn().mockImplementation(() => mockWs);
    (MockWebSocket as any).OPEN = 1;
    (MockWebSocket as any).CLOSED = 0;
    (global as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    client?.disconnect();
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create WebSocket connection with correct URL', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');

      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:3001/terminal?projectId=project-123&userId=user-456'
      );
    });

    it('should call onConnected handler when connected', async () => {
      client = new TerminalWebSocket();
      const onConnected = vi.fn();
      client.setOnConnected(onConnected);

      client.connect(mockUrl, 'project-123', 'user-456');

      // 模拟 WebSocket 打开
      mockWs.onopen();

      expect(onConnected).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should send start message with cols and rows', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.onopen(); // 连接打开

      client.start(80, 24);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'start',
          cols: 80,
          rows: 24,
        })
      );
    });

    it('should not send start if not connected', () => {
      client = new TerminalWebSocket();
      mockWs.readyState = 0; // CLOSED

      client.start(80, 24);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('sendInput', () => {
    it('should send input with base64 encoding', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.onopen();

      // 模拟会话已启动
      mockWs.onmessage({
        data: JSON.stringify({ type: 'started', sessionId: 'session-1' }),
      });

      client.sendInput('ls -la');

      // 'ls -la' 的 base64 编码
      const expectedBase64 = btoa('ls -la');
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'input',
          sessionId: 'session-1',
          data: expectedBase64,
        })
      );
    });

    it('should not send input without session', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.onopen();

      // 没有模拟 started 消息
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      client.sendInput('test');

      expect(mockWs.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No active session, cannot send input');

      consoleSpy.mockRestore();
    });
  });

  describe('resize', () => {
    it('should send resize message', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.onopen();

      // 模拟会话已启动
      mockWs.onmessage({
        data: JSON.stringify({ type: 'started', sessionId: 'session-1' }),
      });

      client.resize(120, 40);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'resize',
          sessionId: 'session-1',
          cols: 120,
          rows: 40,
        })
      );
    });
  });

  describe('message handling', () => {
    it('should decode base64 output and call handler', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');

      const outputHandler = vi.fn();
      client.setOnOutput(outputHandler);

      const testData = 'Hello Terminal!';
      const encoded = btoa(testData);

      mockWs.onmessage({
        data: JSON.stringify({ type: 'output', data: encoded }),
      });

      expect(outputHandler).toHaveBeenCalledWith(testData);
    });

    it('should call onStarted handler when session starts', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');

      const startedHandler = vi.fn();
      client.setOnStarted(startedHandler);

      mockWs.onmessage({
        data: JSON.stringify({ type: 'started', sessionId: 'session-abc' }),
      });

      expect(startedHandler).toHaveBeenCalledWith('session-abc');
      expect(client.getSessionId()).toBe('session-abc');
    });

    it('should call onExit handler', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');

      const exitHandler = vi.fn();
      client.setOnExit(exitHandler);

      mockWs.onmessage({
        data: JSON.stringify({ type: 'exit' }),
      });

      expect(exitHandler).toHaveBeenCalled();
      expect(client.getSessionId()).toBeNull();
    });

    it('should call onError handler', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');

      const errorHandler = vi.fn();
      client.setOnError(errorHandler);

      mockWs.onmessage({
        data: JSON.stringify({ type: 'error', message: 'Container not found' }),
      });

      expect(errorHandler).toHaveBeenCalledWith('Container not found');
    });
  });

  describe('ping', () => {
    it('should send ping message', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.onopen();

      client.ping();

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.readyState = 1; // OPEN

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.readyState = 0; // CLOSED

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');

      client.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should clear session ID', () => {
      client = new TerminalWebSocket();
      client.connect(mockUrl, 'project-123', 'user-456');
      mockWs.onmessage({
        data: JSON.stringify({ type: 'started', sessionId: 'session-1' }),
      });

      expect(client.getSessionId()).toBe('session-1');

      client.disconnect();

      expect(client.getSessionId()).toBeNull();
    });
  });
});