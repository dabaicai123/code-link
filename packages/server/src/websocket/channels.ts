// src/websocket/channels.ts
import WebSocket from 'ws';

interface ClientInfo {
  userId: number;
  userName: string;
  projectId: number;
}

export class ChannelManager {
  // projectId -> Set<WebSocket>
  private channels: Map<number, Set<WebSocket>> = new Map();

  // WebSocket -> ClientInfo
  private clientInfo: Map<WebSocket, ClientInfo> = new Map();

  subscribe(ws: WebSocket, projectId: number, userId: number, userName: string): void {
    // 添加到频道
    if (!this.channels.has(projectId)) {
      this.channels.set(projectId, new Set());
    }
    this.channels.get(projectId)!.add(ws);

    // 保存客户端信息
    this.clientInfo.set(ws, { userId, userName, projectId });
  }

  unsubscribe(ws: WebSocket, projectId: number): void {
    const channel = this.channels.get(projectId);
    if (channel) {
      channel.delete(ws);
      if (channel.size === 0) {
        this.channels.delete(projectId);
      }
    }
    this.clientInfo.delete(ws);
  }

  getChannelClients(projectId: number): Set<WebSocket> {
    return this.channels.get(projectId) || new Set();
  }

  getClientInfo(ws: WebSocket): ClientInfo | undefined {
    return this.clientInfo.get(ws);
  }

  broadcast(projectId: number, message: string, excludeSender?: WebSocket): void {
    const clients = this.channels.get(projectId);
    if (!clients) return;

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN && client !== excludeSender) {
        client.send(message);
      }
    }
  }

  getChannelUserCount(projectId: number): number {
    return this.channels.get(projectId)?.size || 0;
  }
}