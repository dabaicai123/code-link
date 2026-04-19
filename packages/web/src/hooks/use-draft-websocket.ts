'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DraftWebSocket, OnlineUser } from '@/lib/websocket/draft';

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

export function useDraftWebSocket(options: UseDraftWebSocketOptions): UseDraftWebSocketReturn {
  const {
    draftId,
    userId,
    userName,
    onMemberJoined,
    onMemberLeft,
    onStatusChanged,
    onMessageReceived,
    onMessageConfirmed,
  } = options;

  const wsRef = useRef<DraftWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  const wsUrl = typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : '';

  useEffect(() => {
    if (!wsUrl) return;

    const ws = new DraftWebSocket(wsUrl, userId, userName);
    wsRef.current = ws;

    ws.on('connected', () => setIsConnected(true));
    ws.on('disconnected', () => setIsConnected(false));

    ws.on('draft_subscribed', (data: any) => {
      setOnlineUsers(data.onlineUsers || []);
      setMemberCount(data.memberCount || 0);
    });

    ws.on('draft_member_joined', (data: any) => {
      setMemberCount(data.memberCount);
      setOnlineUsers(prev => {
        if (prev.some(u => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, userName: data.userName }];
      });
      onMemberJoined?.(data.userId, data.userName, data.memberCount);
    });

    ws.on('draft_member_left', (data: any) => {
      setMemberCount(data.memberCount);
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      onMemberLeft?.(data.userId, data.userName, data.memberCount);
    });

    ws.on('draft_status_changed', (data: any) => {
      onStatusChanged?.(data.status);
    });

    ws.on('draft_message', (data: any) => {
      onMessageReceived?.(data.message);
    });

    ws.on('draft_message_confirmed', (data: any) => {
      onMessageConfirmed?.(data.messageId, data.userId, data.userName, data.confirmationType);
    });

    return () => {
      ws.unsubscribe();
      ws.disconnect();
    };
  }, [wsUrl, userId, userName, onMemberJoined, onMemberLeft, onStatusChanged, onMessageReceived, onMessageConfirmed]);

  useEffect(() => {
    if (isConnected && draftId && wsRef.current) {
      wsRef.current.subscribe(draftId);
    }
  }, [isConnected, draftId]);

  const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
    wsRef.current?.sendMessage(type, data);
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
    }
    if (wsUrl) {
      wsRef.current = new DraftWebSocket(wsUrl, userId, userName);
    }
  }, [wsUrl, userId, userName]);

  return {
    isConnected,
    onlineUsers,
    memberCount,
    sendMessage,
    reconnect,
  };
}