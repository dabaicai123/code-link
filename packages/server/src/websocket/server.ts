// src/websocket/server.ts
import WebSocket, { WebSocketServer as WSServer } from 'ws';
import type { Server as HttpServer } from 'http';
import { ChannelManager } from './channels.js';
import {
  parseMessage,
  createChatMessage,
  createDraftMemberJoinedEvent,
  createDraftMemberLeftEvent,
  type Message,
} from './types.js';
import { handleTerminalConnection } from '../routes/terminal.js';
import { createLogger, runWithLogContext, generateShortId } from '../logger/index.js';

const logger = createLogger('websocket');

interface SubscribeMessage {
  type: 'subscribe';
  projectId: number;
  userId: number;
  userName: string;
}

interface ChatMessageInput {
  type: 'chat';
  projectId: number;
  userId: number;
  userName: string;
  content: string;
}

interface FileChangeMessage {
  type: 'file_change';
  projectId: number;
  userId: number;
  userName: string;
  [key: string]: unknown;
}

interface DraftSubscribeMessage {
  type: 'draft_subscribe';
  draftId: number;
  userId: number;
  userName: string;
}

interface DraftUnsubscribeMessage {
  type: 'draft_unsubscribe';
  draftId: number;
}

interface IncomingMessage {
  type: string;
  projectId?: number;
  userId?: number;
  userName?: string;
  content?: string;
  draftId?: number;
  [key: string]: unknown;
}

export class WebSocketServer {
  private wss: WSServer;
  private channels: ChannelManager;

  constructor(server: HttpServer) {
    this.wss = new WSServer({ server });
    this.channels = new ChannelManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      // 解析 URL 以区分不同的连接类型
      const url = req.url || '/';
      const urlObj = new URL(url, `http://localhost`);

      // 终端 WebSocket 连接: /terminal?projectId=xxx&userId=xxx
      if (urlObj.pathname === '/terminal') {
        const projectIdStr = urlObj.searchParams.get('projectId');
        const userIdStr = urlObj.searchParams.get('userId');

        if (!projectIdStr || !userIdStr) {
          ws.send(JSON.stringify({ type: 'error', message: '缺少 projectId 或 userId 参数' }));
          ws.close();
          return;
        }

        const projectId = parseInt(projectIdStr, 10);
        const userId = parseInt(userIdStr, 10);

        if (isNaN(projectId) || isNaN(userId)) {
          ws.send(JSON.stringify({ type: 'error', message: '无效的 projectId 或 userId' }));
          ws.close();
          return;
        }

        const reqId = generateShortId();
        runWithLogContext(reqId, () => {
          logger.info(`Terminal WebSocket connected: projectId=${projectId}, userId=${userId}`);
          handleTerminalConnection(ws, projectId, userId);
        });
        return;
      }

      // 实时同步 WebSocket 连接（原有逻辑）
      const reqId = generateShortId();
      (ws as any)._logContext = { reqId };
      runWithLogContext(reqId, () => {
        logger.info('WebSocket client connected');
      });

      ws.on('message', (data) => {
        const context = (ws as any)._logContext;
        if (context) {
          runWithLogContext(context.reqId, () => {
            this.handleMessage(ws, data.toString());
          });
        } else {
          this.handleMessage(ws, data.toString());
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        const context = (ws as any)._logContext;
        if (context) {
          runWithLogContext(context.reqId, () => {
            logger.error('WebSocket error', error);
          });
        } else {
          logger.error('WebSocket error', error);
        }
      });
    });
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    let parsed: IncomingMessage;
    try {
      parsed = JSON.parse(raw) as IncomingMessage;
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    if (!parsed.type) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing message type' }));
      return;
    }

    switch (parsed.type) {
      case 'subscribe':
        this.handleSubscribe(ws, parsed as SubscribeMessage);
        break;
      case 'chat':
        this.handleChat(ws, parsed as ChatMessageInput);
        break;
      case 'file_change':
        this.handleFileChange(ws, parsed as FileChangeMessage);
        break;
      case 'draft_subscribe':
        this.handleDraftSubscribe(ws, parsed as DraftSubscribeMessage);
        break;
      case 'draft_unsubscribe':
        this.handleDraftUnsubscribe(ws, parsed as DraftUnsubscribeMessage);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private handleSubscribe(
    ws: WebSocket,
    msg: SubscribeMessage
  ): void {
    this.channels.subscribe(ws, msg.projectId, msg.userId, msg.userName);

    // 通知频道内其他用户
    const userJoinedMsg = JSON.stringify({
      type: 'user_joined',
      projectId: msg.projectId,
      userId: msg.userId,
      userName: msg.userName,
      timestamp: new Date().toISOString(),
    });
    this.channels.broadcast(msg.projectId, userJoinedMsg, ws);

    // 确认订阅成功
    ws.send(
      JSON.stringify({
        type: 'subscribed',
        projectId: msg.projectId,
        userCount: this.channels.getChannelUserCount(msg.projectId),
      })
    );
  }

  private handleChat(ws: WebSocket, msg: ChatMessageInput): void {
    const chatMsg = createChatMessage(
      msg.projectId,
      msg.userId,
      msg.userName,
      msg.content
    );

    this.channels.broadcast(msg.projectId, JSON.stringify(chatMsg), ws);
  }

  private handleFileChange(ws: WebSocket, msg: FileChangeMessage): void {
    // 广播文件变更到其他客户端
    this.channels.broadcast(msg.projectId, JSON.stringify(msg), ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    // 处理 Project 频道断开
    const info = this.channels.getClientInfo(ws);
    if (info) {
      this.channels.unsubscribe(ws, info.projectId);

      const userLeftMsg = JSON.stringify({
        type: 'user_left',
        projectId: info.projectId,
        userId: info.userId,
        userName: info.userName,
        timestamp: new Date().toISOString(),
      });
      this.channels.broadcast(info.projectId, userLeftMsg);
    }

    // 处理 Draft 频道断开
    const draftInfo = this.channels.getDraftClientInfo(ws);
    if (draftInfo) {
      this.channels.unsubscribeFromDraft(ws, draftInfo.draftId);

      const memberLeftMsg = JSON.stringify(
        createDraftMemberLeftEvent(
          draftInfo.draftId,
          draftInfo.userId,
          draftInfo.userName,
          this.channels.getDraftChannelUserCount(draftInfo.draftId)
        )
      );
      this.channels.broadcastToDraft(draftInfo.draftId, memberLeftMsg);
    }
  }

  private handleDraftSubscribe(ws: WebSocket, msg: DraftSubscribeMessage): void {
    this.channels.subscribeToDraft(ws, msg.draftId, msg.userId, msg.userName);

    const memberJoinedMsg = JSON.stringify(
      createDraftMemberJoinedEvent(
        msg.draftId,
        msg.userId,
        msg.userName,
        this.channels.getDraftChannelUserCount(msg.draftId)
      )
    );
    this.channels.broadcastToDraft(msg.draftId, memberJoinedMsg, ws);

    ws.send(
      JSON.stringify({
        type: 'draft_subscribed',
        draftId: msg.draftId,
        memberCount: this.channels.getDraftChannelUserCount(msg.draftId),
        onlineUsers: this.channels.getDraftChannelUsers(msg.draftId),
      })
    );
  }

  private handleDraftUnsubscribe(ws: WebSocket, msg: DraftUnsubscribeMessage): void {
    const info = this.channels.getDraftClientInfo(ws);
    if (info) {
      this.channels.unsubscribeFromDraft(ws, msg.draftId);

      const memberLeftMsg = JSON.stringify(
        createDraftMemberLeftEvent(
          msg.draftId,
          info.userId,
          info.userName,
          this.channels.getDraftChannelUserCount(msg.draftId)
        )
      );
      this.channels.broadcastToDraft(msg.draftId, memberLeftMsg);
    }
  }

  // 供外部调用：广播构建状态
  broadcastBuildStatus(projectId: number, status: string, previewPort?: number): void {
    const msg = JSON.stringify({
      type: 'build_status',
      projectId,
      status,
      previewPort,
      timestamp: new Date().toISOString(),
    });
    this.channels.broadcast(projectId, msg);
  }

  broadcastDraftMessage(draftId: number, message: unknown, excludeUserId?: number): void {
    const msgStr = JSON.stringify(message);
    const clients = this.channels.getDraftChannelClients(draftId);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        const info = this.channels.getDraftClientInfo(client);
        if (!excludeUserId || info?.userId !== excludeUserId) {
          client.send(msgStr);
        }
      }
    }
  }

  getDraftOnlineUsers(draftId: number): Array<{ userId: number; userName: string }> {
    return this.channels.getDraftChannelUsers(draftId);
  }

  close(): void {
    this.wss.close();
  }
}

let wsServerInstance: WebSocketServer | null = null;

export function createWebSocketServer(server: HttpServer): WebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new WebSocketServer(server);
  }
  return wsServerInstance;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wsServerInstance;
}

// 重置实例（用于测试）
export function resetWebSocketServerInstance(): void {
  wsServerInstance = null;
}
