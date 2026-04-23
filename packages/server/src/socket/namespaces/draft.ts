// packages/server/src/socket/namespaces/draft.ts
import type { Namespace, Socket } from 'socket.io';
import { createLogger } from '../../core/logger/index.js';
import { DraftEvents } from '../types.js';
import type { z } from 'zod';
import {
  addUserToRoom,
  removeUserFromRoom,
  deleteEmptyRoom,
  getRoomUsersMap,
  getRoomUserList,
} from '../utils/room-manager.js';

const logger = createLogger('socket-draft');

export function setupDraftNamespace(namespace: Namespace): void {
  namespace.on('connection', (socket) => {
    const { userId, userName } = socket.data;
    logger.info(`Draft socket connected: userId=${userId}`);

    // 订阅草稿
    socket.on('subscribe', (data: unknown) => {
      const parsed = DraftEvents.subscribe.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid subscribe data' });
        return;
      }

      const { draftId } = parsed.data;
      const roomName = `draft:${draftId}`;

      socket.join(roomName);

      const memberCount = addUserToRoom('draft', draftId, socket.id, { userId, userName });

      // 通知其他用户
      socket.to(roomName).emit('memberJoined', {
        draftId,
        userId,
        userName,
        memberCount,
        timestamp: new Date().toISOString(),
      });

      // 确认订阅，返回在线用户列表
      const onlineUsers = getRoomUserList('draft', draftId);
      socket.emit('subscribed', {
        draftId,
        memberCount: onlineUsers.length,
        onlineUsers,
      });

      logger.debug(`User ${userId} subscribed to draft ${draftId}`);
    });

    // 取消订阅
    socket.on('unsubscribe', (data: unknown) => {
      const parsed = DraftEvents.unsubscribe.safeParse(data);
      if (!parsed.success) return;

      const { draftId } = parsed.data;
      leaveDraftRoom(socket, draftId);
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`Draft socket disconnected: userId=${userId}`);

      for (const [draftId, users] of getRoomUsersMap('draft')) {
        if (users.has(socket.id)) {
          leaveDraftRoom(socket, draftId);
        }
      }
    });
  });
}

function leaveDraftRoom(socket: Socket, draftId: number): void {
  const roomName = `draft:${draftId}`;

  const { user, remainingCount } = removeUserFromRoom('draft', draftId, socket.id);

  if (user) {
    socket.to(roomName).emit('memberLeft', {
      draftId,
      userId: user.userId,
      userName: user.userName,
      memberCount: remainingCount,
      timestamp: new Date().toISOString(),
    });
  }

  // Delete empty room immediately
  if (remainingCount === 0) {
    deleteEmptyRoom('draft', draftId);
  }

  socket.leave(roomName);
}

// 外部 API: 广播草稿消息
export function broadcastDraftMessage(
  namespace: Namespace,
  draftId: number,
  message: z.infer<typeof DraftEvents.draftMessage>['message'],
  excludeUserId?: number
): void {
  const roomName = `draft:${draftId}`;
  const event = {
    draftId,
    message,
    timestamp: new Date().toISOString(),
  };

  if (excludeUserId) {
    // 找到需要排除的 socket
    const users = getRoomUsersMap('draft').get(draftId);
    if (users) {
      for (const [socketId, user] of users) {
        if (user.userId !== excludeUserId) {
          const targetSocket = namespace.sockets.get(socketId);
          targetSocket?.emit('draftMessage', event);
        }
      }
      return;
    }
  }

  namespace.to(roomName).emit('draftMessage', event);
}

// 获取在线用户
export function getDraftOnlineUsers(draftId: number): Array<{ userId: number; userName: string }> {
  return getRoomUserList('draft', draftId);
}