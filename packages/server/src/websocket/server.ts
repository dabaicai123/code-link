// src/websocket/server.ts
import WebSocket, { WebSocketServer as WSServer } from 'ws';
import type { Server as HttpServer } from 'http';
import type Database from 'better-sqlite3';
import { ChannelManager } from './channels.js';
import {
  parseMessage,
  createChatMessage,
  type Message,
} from './types.js';
import { handleTerminalConnection } from '../routes/terminal.js';

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

interface IncomingMessage {
  type: string;
  projectId?: number;
  userId?: number;
  userName?: string;
  content?: string;
  [key: string]: unknown;
}

export class WebSocketServer {
  private wss: WSServer;
  private channels: ChannelManager;
  private db: Database.Database | null = null;

  constructor(server: HttpServer, db?: Database.Database) {
    this.wss = new WSServer({ server });
    this.channels = new ChannelManager();
    if (db) {
      this.db = db;
    }
    this.setupHandlers();
  }

  /**
   * 设置数据库实例（用于延迟注入）
   */
  setDb(db: Database.Database): void {
    this.db = db;
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

        if (!this.db) {
          ws.send(JSON.stringify({ type: 'error', message: '数据库未初始化' }));
          ws.close();
          return;
        }

        console.log(`Terminal WebSocket connected: projectId=${projectId}, userId=${userId}`);
        handleTerminalConnection(ws, projectId, userId, this.db);
        return;
      }

      // 实时同步 WebSocket 连接（原有逻辑）
      console.log('WebSocket client connected');

      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
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
    const info = this.channels.getClientInfo(ws);
    if (info) {
      this.channels.unsubscribe(ws, info.projectId);

      // 通知其他用户
      const userLeftMsg = JSON.stringify({
        type: 'user_left',
        projectId: info.projectId,
        userId: info.userId,
        userName: info.userName,
        timestamp: new Date().toISOString(),
      });
      this.channels.broadcast(info.projectId, userLeftMsg);
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

  close(): void {
    this.wss.close();
  }
}

let wsServerInstance: WebSocketServer | null = null;

export function createWebSocketServer(server: HttpServer, db?: Database.Database): WebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new WebSocketServer(server, db);
  } else if (db) {
    // 如果实例已存在但 db 未设置，则设置 db
    wsServerInstance.setDb(db);
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
