import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketBase } from '../src/lib/websocket/base';

describe('WebSocketClient (WebSocketBase)', () => {
  let client: WebSocketBase;
  let mockWsInstance: any;
  const mockUrl = 'ws://localhost:3001';

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
    vi.restoreAllMocks();
  });

  it('should create connection', () => {
    client = new WebSocketBase(mockUrl);
    expect(global.WebSocket).toHaveBeenCalledWith(mockUrl);
  });

  it('should subscribe to project channel', async () => {
    client = new WebSocketBase(mockUrl);

    const subscribedPromise = new Promise((resolve) => {
      client.on('subscribed', (data) => {
        resolve(data);
      });
    });

    client.send({ type: 'subscribe', projectId: 1, userId: 100, userName: 'test-user' });

    mockWsInstance.onmessage?.({ data: JSON.stringify({ type: 'subscribed', projectId: 1 }) });

    const data = await subscribedPromise as any;
    expect(data.projectId).toBe(1);
  });

  it('should emit chat messages', async () => {
    client = new WebSocketBase(mockUrl);

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

    mockWsInstance.onmessage?.({ data: JSON.stringify(mockMessage) });

    const data = await chatPromise as any;
    expect(data.content).toBe('Hello!');
  });

  it('should send chat messages', () => {
    client = new WebSocketBase(mockUrl);

    client.send({
      type: 'chat',
      projectId: 1,
      userId: 100,
      userName: 'test',
      content: 'Hello everyone!',
    });

    expect(mockWsInstance.send).toHaveBeenCalledWith(
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