// tests/channels.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelManager } from '../src/websocket/channels.ts';
import WebSocket from 'ws';

describe('ChannelManager', () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  it('should add client to channel', () => {
    const mockWs = {} as WebSocket;

    manager.subscribe(mockWs, 1, 100, 'test-user');

    const clients = manager.getChannelClients(1);
    expect(clients.size).toBe(1);
    expect(clients.has(mockWs)).toBe(true);
  });

  it('should remove client from channel', () => {
    const mockWs = {} as WebSocket;

    manager.subscribe(mockWs, 1, 100, 'test-user');
    manager.unsubscribe(mockWs, 1);

    const clients = manager.getChannelClients(1);
    expect(clients.size).toBe(0);
  });

  it('should get user info for a client', () => {
    const mockWs = {} as WebSocket;

    manager.subscribe(mockWs, 1, 100, 'test-user');

    const userInfo = manager.getClientInfo(mockWs);
    expect(userInfo?.userId).toBe(100);
    expect(userInfo?.userName).toBe('test-user');
  });

  it('should broadcast message to all clients in channel', () => {
    const mockWs1 = { send: vi.fn(), readyState: WebSocket.OPEN } as unknown as WebSocket;
    const mockWs2 = { send: vi.fn(), readyState: WebSocket.OPEN } as unknown as WebSocket;
    const mockWs3 = { send: vi.fn(), readyState: WebSocket.OPEN } as unknown as WebSocket;

    manager.subscribe(mockWs1, 1, 100, 'user1');
    manager.subscribe(mockWs2, 1, 101, 'user2');
    manager.subscribe(mockWs3, 2, 102, 'user3');

    const message = JSON.stringify({ type: 'chat', content: 'hello' });
    manager.broadcast(1, message, mockWs1); // 排除发送者

    expect(mockWs1.send).not.toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalledWith(message);
    expect(mockWs3.send).not.toHaveBeenCalled(); // 不同频道
  });
});