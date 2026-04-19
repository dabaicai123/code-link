import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalWebSocket } from '../src/lib/websocket/terminal';

describe('TerminalWebSocket', () => {
  let client: TerminalWebSocket;
  let mockWsInstance: any;
  const mockUrl = 'ws://localhost:3001/terminal';

  beforeEach(() => {
    mockWsInstance = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };

    global.WebSocket = vi.fn().mockImplementation(() => mockWsInstance) as any;
  });

  afterEach(() => {
    client?.disconnect();
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create WebSocket connection with correct URL', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');

      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:3001/terminal?projectId=project-123&userId=user-456'
      );
    });

    it('should emit connected event when connected', async () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      const onConnected = vi.fn();
      client.on('connected', onConnected);

      mockWsInstance.onopen?.();

      expect(onConnected).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should send start message with cols and rows', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.onopen?.();

      client.start(80, 24);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'start',
          cols: 80,
          rows: 24,
        })
      );
    });

    it('should not send start if not connected', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.readyState = 0;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      client.start(80, 24);

      expect(mockWsInstance.send).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('sendInput', () => {
    it('should send input with base64 encoding', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.onopen?.();

      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'started', sessionId: 'session-1' }),
      });

      client.sendInput('ls -la');

      const expectedBase64 = btoa('ls -la');
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'input',
          sessionId: 'session-1',
          data: expectedBase64,
        })
      );
    });

    it('should not send input without session', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.onopen?.();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      client.sendInput('test');

      expect(mockWsInstance.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No active session, cannot send input');

      consoleSpy.mockRestore();
    });
  });

  describe('resize', () => {
    it('should send resize message', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.onopen?.();

      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'started', sessionId: 'session-1' }),
      });

      client.resize(120, 40);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
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
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');

      const outputHandler = vi.fn();
      client.setOnOutput(outputHandler);

      const testData = 'Hello Terminal!';
      const encoded = btoa(testData);

      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'output', data: encoded }),
      });

      expect(outputHandler).toHaveBeenCalledWith(testData);
    });

    it('should call onStarted handler when session starts', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');

      const startedHandler = vi.fn();
      client.setOnStarted(startedHandler);

      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'started', sessionId: 'session-abc' }),
      });

      expect(startedHandler).toHaveBeenCalledWith('session-abc');
      expect(client.getSessionId()).toBe('session-abc');
    });

    it('should call onExit handler', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');

      const exitHandler = vi.fn();
      client.setOnExit(exitHandler);

      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'exit' }),
      });

      expect(exitHandler).toHaveBeenCalled();
      expect(client.getSessionId()).toBeNull();
    });

    it('should call onError handler', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');

      const errorHandler = vi.fn();
      client.setOnError(errorHandler);

      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'error', message: 'Container not found' }),
      });

      expect(errorHandler).toHaveBeenCalledWith('Container not found');
    });
  });

  describe('ping', () => {
    it('should send ping message', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.onopen?.();

      client.ping();

      expect(mockWsInstance.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.readyState = 1;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.readyState = 0;

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');

      client.disconnect();

      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('should clear session ID', () => {
      client = new TerminalWebSocket(mockUrl, 'project-123', 'user-456');
      mockWsInstance.onmessage?.({
        data: JSON.stringify({ type: 'started', sessionId: 'session-1' }),
      });

      expect(client.getSessionId()).toBe('session-1');

      client.disconnect();

      expect(client.getSessionId()).toBeNull();
    });
  });
});