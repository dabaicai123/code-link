// packages/web/src/lib/socket/draft.ts
'use client';

import { useEffect, useState } from 'react';
import { getDraftSocket } from './index';
import type { DraftMessageBroadcast, DraftOnlineUser } from './types';

interface UseDraftSocketOptions {
  draftId: number | null;
  onMessage?: (msg: DraftMessageBroadcast) => void;
  onMemberJoined?: (user: DraftOnlineUser, memberCount: number) => void;
  onMemberLeft?: (user: DraftOnlineUser, memberCount: number) => void;
}

export function useDraftSocket(options: UseDraftSocketOptions) {
  const { draftId, onMessage, onMemberJoined, onMemberLeft } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<DraftOnlineUser[]>([]);

  const socket = getDraftSocket();

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
    if (!draftId || !isConnected) return;

    socket.emit('subscribe', { draftId });

    const handleSubscribed = (data: { draftId: number; memberCount: number; onlineUsers: DraftOnlineUser[] }) => {
      setMemberCount(data.memberCount);
      setOnlineUsers(data.onlineUsers);
    };

    const handleMemberJoined = (data: { userId: number; userName: string; memberCount: number }) => {
      setMemberCount(data.memberCount);
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, userName: data.userName }];
      });
      onMemberJoined?.({ userId: data.userId, userName: data.userName }, data.memberCount);
    };

    const handleMemberLeft = (data: { userId: number; userName: string; memberCount: number }) => {
      setMemberCount(data.memberCount);
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      onMemberLeft?.({ userId: data.userId, userName: data.userName }, data.memberCount);
    };

    const handleMessage = (msg: DraftMessageBroadcast) => {
      onMessage?.(msg);
    };

    socket.on('subscribed', handleSubscribed);
    socket.on('memberJoined', handleMemberJoined);
    socket.on('memberLeft', handleMemberLeft);
    socket.on('draftMessage', handleMessage);

    return () => {
      socket.emit('unsubscribe', { draftId });
      socket.off('subscribed', handleSubscribed);
      socket.off('memberJoined', handleMemberJoined);
      socket.off('memberLeft', handleMemberLeft);
      socket.off('draftMessage', handleMessage);
    };
  }, [draftId, isConnected, socket, onMessage, onMemberJoined, onMemberLeft]);

  return {
    isConnected,
    memberCount,
    onlineUsers,
  };
}