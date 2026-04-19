'use client';

import { useDraftSocket } from '@/lib/socket/draft';
import type { DraftOnlineUser } from '@/lib/socket/types';

export interface UseDraftWebSocketOptions {
  draftId: number | null;
  userId: number;
  userName: string;
  onMemberJoined?: (userId: number, userName: string, memberCount: number) => void;
  onMemberLeft?: (userId: number, userName: string, memberCount: number) => void;
  onStatusChanged?: (status: string) => void;
  onMessageReceived?: (message: unknown) => void;
  onMessageConfirmed?: (messageId: number, userId: number, userName: string, type: string) => void;
}

export interface UseDraftWebSocketReturn {
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  memberCount: number;
  sendMessage: (type: string, data: Record<string, unknown>) => void;
  reconnect: () => void;
}

export type OnlineUser = DraftOnlineUser;

export function useDraftWebSocket(options: UseDraftWebSocketOptions): UseDraftWebSocketReturn {
  const {
    draftId,
    onMemberJoined,
    onMemberLeft,
    onMessageReceived,
  } = options;

  const { isConnected, memberCount, onlineUsers } = useDraftSocket({
    draftId,
    onMessage: (msg) => {
      onMessageReceived?.(msg.message);
    },
    onMemberJoined: (user, count) => {
      onMemberJoined?.(user.userId, user.userName, count);
    },
    onMemberLeft: (user, count) => {
      onMemberLeft?.(user.userId, user.userName, count);
    },
  });

  // sendMessage 和 reconnect 暂时不实现，因为新架构下不需要
  const sendMessage = (_type: string, _data: Record<string, unknown>) => {
    // TODO: 实现消息发送
  };

  const reconnect = () => {
    // Socket.IO 自动重连，无需手动实现
  };

  return {
    isConnected,
    onlineUsers,
    memberCount,
    sendMessage,
    reconnect,
  };
}