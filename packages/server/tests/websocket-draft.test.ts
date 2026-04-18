// packages/server/tests/websocket-draft.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import { WebSocketServer, resetWebSocketServerInstance } from '../src/websocket/server.js';

describe('Draft WebSocket', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    resetWebSocketServerInstance();
    httpServer = createServer();
    wsServer = new WebSocketServer(httpServer);

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

  describe('draft_subscribe', () => {
    it('should subscribe to draft channel', async () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 100,
            userName: 'Test User',
          }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'draft_subscribed') {
            expect(msg.draftId).toBe(1);
            expect(msg.memberCount).toBe(1);
            expect(msg.onlineUsers).toHaveLength(1);
            ws.close();
            resolve();
          }
        });
      });
    });

    it('should notify other users when member joins', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}`);
      const ws2 = new WebSocket(`ws://localhost:${port}`);

      // 等待两个连接打开
      await new Promise<void>((resolve) => {
        let connected = 0;
        const checkConnected = () => {
          connected++;
          if (connected === 2) resolve();
        };
        ws1.on('open', checkConnected);
        ws2.on('open', checkConnected);
      });

      // 设置 ws1 来监听 member_joined 事件
      const memberJoinedPromise = new Promise<void>((resolve) => {
        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'draft_subscribed') {
            // ws1 订阅确认，现在让 ws2 订阅
            ws2.send(JSON.stringify({
              type: 'draft_subscribe',
              draftId: 1,
              userId: 101,
              userName: 'User 2',
            }));
          } else if (msg.type === 'draft_member_joined') {
            expect(msg.userId).toBe(101);
            expect(msg.userName).toBe('User 2');
            expect(msg.memberCount).toBe(2);
            ws1.close();
            ws2.close();
            resolve();
          }
        });
      });

      // 第一个用户订阅
      ws1.send(JSON.stringify({
        type: 'draft_subscribe',
        draftId: 1,
        userId: 100,
        userName: 'User 1',
      }));

      await memberJoinedPromise;
    });
  });

  describe('draft_unsubscribe', () => {
    it('should notify other users when member leaves', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}`);
      const ws2 = new WebSocket(`ws://localhost:${port}`);

      // 两个用户订阅
      await new Promise<void>((resolve) => {
        let connected = 0;
        const checkConnected = () => {
          connected++;
          if (connected === 2) resolve();
        };

        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 100,
            userName: 'User 1',
          }));
          checkConnected();
        });

        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 101,
            userName: 'User 2',
          }));
          checkConnected();
        });
      });

      // 等待两个订阅确认
      await new Promise<void>((resolve) => {
        let acks = 0;
        const checkAcks = () => {
          acks++;
          if (acks === 2) resolve();
        };
        ws1.once('message', () => checkAcks());
        ws2.once('message', () => checkAcks());
      });

      // 用户2 取消订阅
      await new Promise<void>((resolve) => {
        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'draft_member_left') {
            expect(msg.memberCount).toBe(1);
            ws1.close();
            resolve();
          }
        });

        setTimeout(() => {
          ws2.send(JSON.stringify({
            type: 'draft_unsubscribe',
            draftId: 1,
          }));
          ws2.close();
        }, 100);
      });
    });
  });

  describe('broadcastDraftMessage', () => {
    it('should broadcast message to draft channel', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}`);
      const ws2 = new WebSocket(`ws://localhost:${port}`);

      await new Promise<void>((resolve) => {
        let connected = 0;
        const checkConnected = () => {
          connected++;
          if (connected === 2) resolve();
        };

        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 100,
            userName: 'User 1',
          }));
          checkConnected();
        });

        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 101,
            userName: 'User 2',
          }));
          checkConnected();
        });
      });

      // 等待两个订阅确认
      await new Promise<void>((resolve) => {
        let acks = 0;
        const checkAcks = () => {
          acks++;
          if (acks === 2) resolve();
        };
        ws1.once('message', () => checkAcks());
        ws2.once('message', () => checkAcks());
      });

      wsServer.broadcastDraftMessage(1, { type: 'test_broadcast', data: 'hello' });

      await new Promise<void>((resolve) => {
        let received = 0;
        const checkReceived = () => {
          received++;
          if (received === 2) {
            ws1.close();
            ws2.close();
            resolve();
          }
        };

        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'test_broadcast') {
            expect(msg.data).toBe('hello');
            checkReceived();
          }
        });

        ws2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'test_broadcast') {
            expect(msg.data).toBe('hello');
            checkReceived();
          }
        });
      });
    });

    it('should exclude user when specified', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}`);
      const ws2 = new WebSocket(`ws://localhost:${port}`);

      await new Promise<void>((resolve) => {
        let connected = 0;
        const checkConnected = () => {
          connected++;
          if (connected === 2) resolve();
        };

        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 100,
            userName: 'User 1',
          }));
          checkConnected();
        });

        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 101,
            userName: 'User 2',
          }));
          checkConnected();
        });
      });

      // 等待两个订阅确认
      await new Promise<void>((resolve) => {
        let acks = 0;
        const checkAcks = () => {
          acks++;
          if (acks === 2) resolve();
        };
        ws1.once('message', () => checkAcks());
        ws2.once('message', () => checkAcks());
      });

      // 广播消息，排除 userId=100
      wsServer.broadcastDraftMessage(1, { type: 'test_broadcast', data: 'hello' }, 100);

      await new Promise<void>((resolve) => {
        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            ws1.close();
            ws2.close();
            resolve();
          }
        };

        ws2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'test_broadcast') {
            expect(msg.data).toBe('hello');
            done();
          }
        });

        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'test_broadcast') {
            // 如果 userId=100 收到消息，测试失败
            expect.fail('User 100 should not receive the message');
          }
        });

        // 超时后如果没有消息收到，也认为测试通过
        setTimeout(done, 500);
      });
    });
  });

  describe('getDraftOnlineUsers', () => {
    it('should return list of online users', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}`);
      const ws2 = new WebSocket(`ws://localhost:${port}`);

      await new Promise<void>((resolve) => {
        let connected = 0;
        const checkConnected = () => {
          connected++;
          if (connected === 2) resolve();
        };

        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 100,
            userName: 'User 1',
          }));
          checkConnected();
        });

        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'draft_subscribe',
            draftId: 1,
            userId: 101,
            userName: 'User 2',
          }));
          checkConnected();
        });
      });

      // 等待订阅确认
      await new Promise<void>((resolve) => {
        let acks = 0;
        const checkAcks = () => {
          acks++;
          if (acks === 2) resolve();
        };
        ws1.once('message', () => checkAcks());
        ws2.once('message', () => checkAcks());
      });

      const users = wsServer.getDraftOnlineUsers(1);
      expect(users).toHaveLength(2);
      expect(users.find(u => u.userId === 100)).toBeDefined();
      expect(users.find(u => u.userId === 101)).toBeDefined();

      ws1.close();
      ws2.close();
    });
  });
});