'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../lib/use-websocket';

interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  content?: string;
}

interface ChatMessage {
  id: string;
  userId: number;
  userName: string;
  content: string;
  timestamp: string;
}

interface BuildStatus {
  status: 'pending' | 'running' | 'success' | 'failed';
  previewPort?: number;
}

interface OnlineUser {
  userId: number;
  userName: string;
}

export function useProjectSync(
  projectId: number,
  userId: number,
  userName: string
) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

  const { isConnected, onMessage, sendChat } = useWebSocket({
    url: wsUrl,
    projectId,
    userId,
    userName,
  });

  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // 监听文件变更
    unsubscribers.push(
      onMessage('file_change', (data) => {
        setFileChanges((prev) => [...prev, data]);
      })
    );

    // 监听聊天消息
    unsubscribers.push(
      onMessage('chat', (data) => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `${data.userId}-${Date.now()}`,
            userId: data.userId,
            userName: data.userName,
            content: data.content,
            timestamp: data.timestamp,
          },
        ]);
      })
    );

    // 监听用户加入
    unsubscribers.push(
      onMessage('user_joined', (data) => {
        setOnlineUsers((prev) => {
          if (prev.some((u) => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, userName: data.userName }];
        });
      })
    );

    // 监听用户离开
    unsubscribers.push(
      onMessage('user_left', (data) => {
        setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      })
    );

    // 监听构建状态
    unsubscribers.push(
      onMessage('build_status', (data) => {
        setBuildStatus({
          status: data.status,
          previewPort: data.previewPort,
        });
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [onMessage]);

  const clearFileChanges = useCallback(() => {
    setFileChanges([]);
  }, []);

  return {
    isConnected,
    fileChanges,
    chatMessages,
    onlineUsers,
    buildStatus,
    sendChat,
    clearFileChanges,
  };
}
