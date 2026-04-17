// tests/websocket-server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import { createWebSocketServer, WebSocketServer, resetWebSocketServerInstance } from '../src/websocket/server.ts';

describe('WebSocket Server', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    wsServer = createWebSocketServer(httpServer);

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
  });

  it('should accept WebSocket connections', async () => {
    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        client.close();
        resolve();
      });
    });
  });

  it('should handle subscription messages', async () => {
    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'subscribe',
          projectId: 1,
          userId: 100,
          userName: 'test-user',
        }));

        client.once('message', (data) => {
          const msg = JSON.parse(data.toString());
          expect(msg.type).toBe('subscribed');
          expect(msg.projectId).toBe(1);
          client.close();
          resolve();
        });
      });
    });
  });

  it('should broadcast messages to same channel', async () => {
    const client1 = new WebSocket(`ws://localhost:${port}`);
    const client2 = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      let connected = 0;

      const onOpen = () => {
        connected++;
        if (connected === 2) {
          // 两个客户端都订阅同一个项目
          client1.send(JSON.stringify({
            type: 'subscribe',
            projectId: 1,
            userId: 100,
            userName: 'user1',
          }));

          client2.send(JSON.stringify({
            type: 'subscribe',
            projectId: 1,
            userId: 101,
            userName: 'user2',
          }));
        }
      };

      client1.on('open', onOpen);
      client2.on('open', onOpen);

      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribed') {
          // client2 订阅成功后，client1 发送聊天消息
          client1.send(JSON.stringify({
            type: 'chat',
            projectId: 1,
            userId: 100,
            userName: 'user1',
            content: 'Hello!',
          }));
        } else if (msg.type === 'chat') {
          expect(msg.content).toBe('Hello!');
          expect(msg.userId).toBe(100);
          client1.close();
          client2.close();
          resolve();
        }
      });
    });
  });
});
