// packages/web/src/lib/socket/project.ts
'use client';

import { useEffect, useCallback, useState } from 'react';
import { getProjectSocket } from './index';
import type { ProjectChatMessageEvent, ProjectBuildStatusEvent } from './types';

interface OnlineUser {
  userId: number;
  userName: string;
}

interface UseProjectSocketOptions {
  projectId: number | null;
  onChatMessage?: (msg: ProjectChatMessageEvent) => void;
  onUserJoined?: (user: OnlineUser) => void;
  onUserLeft?: (user: OnlineUser) => void;
  onBuildStatus?: (status: ProjectBuildStatusEvent) => void;
}

export function useProjectSocket(options: UseProjectSocketOptions) {
  const { projectId, onChatMessage, onUserJoined, onUserLeft, onBuildStatus } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);

  const socket = getProjectSocket();

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!projectId || !isConnected) return;

    socket.emit('subscribe', { projectId });

    const handleSubscribed = (data: { projectId: number; userCount: number }) => {
      setUserCount(data.userCount);
    };

    const handleUserJoined = (data: { userId: number; userName: string }) => {
      setUserCount((c) => c + 1);
      onUserJoined?.({ userId: data.userId, userName: data.userName });
    };

    const handleUserLeft = (data: { userId: number; userName: string }) => {
      setUserCount((c) => Math.max(0, c - 1));
      onUserLeft?.({ userId: data.userId, userName: data.userName });
    };

    const handleChatMessage = (msg: ProjectChatMessageEvent) => {
      onChatMessage?.(msg);
    };

    const handleBuildStatus = (status: ProjectBuildStatusEvent) => {
      onBuildStatus?.(status);
    };

    socket.on('subscribed', handleSubscribed);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('chatMessage', handleChatMessage);
    socket.on('buildStatus', handleBuildStatus);

    return () => {
      socket.emit('unsubscribe', { projectId });
      socket.off('subscribed', handleSubscribed);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
      socket.off('chatMessage', handleChatMessage);
      socket.off('buildStatus', handleBuildStatus);
    };
  }, [projectId, isConnected, socket, onChatMessage, onUserJoined, onUserLeft, onBuildStatus]);

  const sendChat = useCallback(
    (content: string) => {
      if (projectId) {
        socket.emit('chat', { projectId, content });
      }
    },
    [projectId, socket]
  );

  const sendFileChange = useCallback(
    (path: string, action: 'created' | 'modified' | 'deleted', content?: string) => {
      if (projectId) {
        socket.emit('fileChange', { projectId, path, action, content });
      }
    },
    [projectId, socket]
  );

  return {
    isConnected,
    userCount,
    sendChat,
    sendFileChange,
  };
}