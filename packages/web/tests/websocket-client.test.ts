import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from '../src/lib/websocket-client';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  const mockUrl = 'ws://localhost:3001';

  beforeEach(() => {
    const MockWebSocket = vi.fn().mockImplementation(() => ({
      readyState: 1, // Set to OPEN by default for easier testing
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    }));
    (MockWebSocket as any).OPEN = 1;
    (MockWebSocket as any).CLOSED = 0;
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    client?.disconnect();
  });

  it('should create connection', () => {
    client = new WebSocketClient(mockUrl);
    expect(global.WebSocket).toHaveBeenCalledWith(mockUrl);
  });

  it('should subscribe to project channel', async () => {
    client = new WebSocketClient(mockUrl);

    const subscribedPromise = new Promise((resolve) => {
      client.on('subscribed', (data) => {
        resolve(data);
      });
    });

    client.subscribe(1, 100, 'test-user');

    // 模拟服务器响应
    (client as any).ws.onmessage({ data: JSON.stringify({ type: 'subscribed', projectId: 1 }) });

    const data = await subscribedPromise as any;
    expect(data.projectId).toBe(1);
  });

  it('should emit chat messages', async () => {
    client = new WebSocketClient(mockUrl);

    const chatPromise = new Promise((resolve) => {
      client.on('chat', (data) => {
        resolve(data);
      });
    });

    const mockMessage = {
      type: 'chat',
      projectId: 1,
      userId: 100,
      userName: 'test',
      content: 'Hello!',
    };

    (client as any).ws.onmessage({ data: JSON.stringify(mockMessage) });

    const data = await chatPromise as any;
    expect(data.content).toBe('Hello!');
  });

  it('should send chat messages', () => {
    client = new WebSocketClient(mockUrl);

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