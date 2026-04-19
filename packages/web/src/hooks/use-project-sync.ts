'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProjectSocket } from '@/lib/socket/project';
import type { ProjectChatMessageEvent, ProjectBuildStatusEvent } from '@/lib/socket/types';

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
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);

  const handleChatMessage = useCallback((msg: ProjectChatMessageEvent) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${msg.userId}-${Date.now()}`,
        userId: msg.userId,
        userName: msg.userName,
        content: msg.content,
        timestamp: msg.timestamp,
      },
    ]);
  }, []);

  const handleUserJoined = useCallback((user: OnlineUser) => {
    setOnlineUsers((prev) => {
      if (prev.some((u) => u.userId === user.userId)) return prev;
      return [...prev, user];
    });
  }, []);

  const handleUserLeft = useCallback((user: OnlineUser) => {
    setOnlineUsers((prev) => prev.filter((u) => u.userId !== user.userId));
  }, []);

  const handleBuildStatus = useCallback((status: ProjectBuildStatusEvent) => {
    setBuildStatus({
      status: status.status,
      previewPort: status.previewPort,
    });
  }, []);

  const { isConnected, userCount, sendChat, sendFileChange } = useProjectSocket({
    projectId,
    onChatMessage: handleChatMessage,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onBuildStatus: handleBuildStatus,
  });

  const clearFileChanges = useCallback(() => {
    setFileChanges([]);
  }, []);

  return {
    isConnected,
    userCount,
    fileChanges,
    chatMessages,
    onlineUsers,
    buildStatus,
    sendChat,
    sendFileChange,
    clearFileChanges,
  };
}