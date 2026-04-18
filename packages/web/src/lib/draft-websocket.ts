'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface DraftWSMessage {
  type: string;
  draftId: number;
  timestamp: string;
  [key: string]: unknown;
}

export interface OnlineUser {
  userId: number;
  userName: string;
}

export interface UseDraftWebSocketOptions {
  draftId: number | null;
  userId: number;
  userName: string;
  onMessage?: (message: DraftWSMessage) => void;
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
    onMessage,
    onMemberJoined,
    onMemberLeft,
    onStatusChanged,
    onMessageReceived,
    onMessageConfirmed,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  const connect = useCallback(() => {
    if (!draftId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'draft_subscribe',
        draftId,
        userId,
        userName,
      }));
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as DraftWSMessage;
        onMessage?.(message);

        switch (message.type) {
          case 'draft_subscribed':
            setOnlineUsers((message as any).onlineUsers || []);
            setMemberCount((message as any).memberCount || 0);
            break;

          case 'draft_member_joined':
            const joinedMsg = message as any;
            setMemberCount(joinedMsg.memberCount);
            setOnlineUsers(prev => {
              if (prev.some(u => u.userId === joinedMsg.userId)) return prev;
              return [...prev, { userId: joinedMsg.userId, userName: joinedMsg.userName }];
            });
            onMemberJoined?.(joinedMsg.userId, joinedMsg.userName, joinedMsg.memberCount);
            break;

          case 'draft_member_left':
            const leftMsg = message as any;
            setMemberCount(leftMsg.memberCount);
            setOnlineUsers(prev => prev.filter(u => u.userId !== leftMsg.userId));
            onMemberLeft?.(leftMsg.userId, leftMsg.userName, leftMsg.memberCount);
            break;

          case 'draft_status_changed':
            onStatusChanged?.((message as any).status);
            break;

          case 'draft_message':
            onMessageReceived?.((message as any).message);
            break;

          case 'draft_message_confirmed':
            const confirmMsg = message as any;
            onMessageConfirmed?.(
              confirmMsg.messageId,
              confirmMsg.userId,
              confirmMsg.userName,
              confirmMsg.confirmationType
            );
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }, [draftId, userId, userName, onMessage, onMemberJoined, onMemberLeft, onStatusChanged, onMessageReceived, onMessageConfirmed]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'draft_unsubscribe',
        draftId,
      }));
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [draftId]);

  const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    isConnected,
    onlineUsers,
    memberCount,
    sendMessage,
    reconnect: connect,
  };
}