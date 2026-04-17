'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient } from './websocket-client';

interface UseWebSocketOptions {
  url: string;
  projectId?: number;
  userId?: number;
  userName?: string;
}

export function useWebSocket({
  url,
  projectId,
  userId,
  userName,
}: UseWebSocketOptions) {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    clientRef.current = new WebSocketClient(url);

    clientRef.current.on('connected', () => setIsConnected(true));
    clientRef.current.on('disconnected', () => setIsConnected(false));

    return () => {
      clientRef.current?.disconnect();
    };
  }, [url]);

  useEffect(() => {
    if (isConnected && projectId && userId && userName) {
      clientRef.current?.subscribe(projectId, userId, userName);
    }
  }, [isConnected, projectId, userId, userName]);

  const onMessage = useCallback((eventType: string, handler: (data: any) => void) => {
    clientRef.current?.on(eventType, handler);
    return () => clientRef.current?.off(eventType, handler);
  }, []);

  const sendChat = useCallback(
    (content: string) => {
      if (projectId && userId && userName) {
        clientRef.current?.sendChat(projectId, userId, userName, content);
      }
    },
    [projectId, userId, userName]
  );

  return {
    isConnected,
    onMessage,
    sendChat,
  };
}