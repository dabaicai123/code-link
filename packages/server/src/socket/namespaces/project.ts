// packages/server/src/socket/namespaces/project.ts
import type { Namespace, Socket } from 'socket.io';
import { createLogger } from '../../logger/index.js';
import { ProjectEvents } from '../types.js';
import {
  addUserToProjectRoom,
  removeUserFromProjectRoom,
  deleteEmptyProjectRoom,
  getProjectRoomUsers,
} from '../utils/room-manager.js';

const logger = createLogger('socket-project');

export function setupProjectNamespace(namespace: Namespace): void {
  namespace.on('connection', (socket) => {
    const { userId, userName } = socket.data;
    logger.info(`Project socket connected: userId=${userId}`);

    // 订阅项目
    socket.on('subscribe', (data: unknown) => {
      const parsed = ProjectEvents.subscribe.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid subscribe data' });
        return;
      }

      const { projectId } = parsed.data;
      const roomName = `project:${projectId}`;

      // 加入房间
      socket.join(roomName);

      // 记录用户
      const userCount = addUserToProjectRoom(projectId, socket.id, { userId, userName });

      // 通知其他用户
      socket.to(roomName).emit('userJoined', {
        projectId,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });

      // 确认订阅
      socket.emit('subscribed', {
        projectId,
        userCount,
      });

      logger.debug(`User ${userId} subscribed to project ${projectId}`);
    });

    // 取消订阅
    socket.on('unsubscribe', (data: unknown) => {
      const parsed = ProjectEvents.unsubscribe.safeParse(data);
      if (!parsed.success) return;

      const { projectId } = parsed.data;
      leaveProjectRoom(socket, projectId);
    });

    // 聊天消息
    socket.on('chat', (data: unknown) => {
      const parsed = ProjectEvents.chat.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid chat data' });
        return;
      }

      const { projectId, content } = parsed.data;
      const roomName = `project:${projectId}`;

      namespace.to(roomName).emit('chatMessage', {
        projectId,
        userId,
        userName,
        content,
        timestamp: new Date().toISOString(),
      });
    });

    // 文件变更
    socket.on('fileChange', (data: unknown) => {
      const parsed = ProjectEvents.fileChange.safeParse(data);
      if (!parsed.success) return;

      const { projectId, path, action, content } = parsed.data;
      const roomName = `project:${projectId}`;

      socket.to(roomName).emit('fileChange', {
        projectId,
        path,
        action,
        content,
        timestamp: new Date().toISOString(),
      });
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`Project socket disconnected: userId=${userId}`);

      // 清理所有房间
      for (const [projectId, users] of getProjectRoomUsers()) {
        if (users.has(socket.id)) {
          leaveProjectRoom(socket, projectId);
        }
      }
    });
  });
}

function leaveProjectRoom(socket: Socket, projectId: number): void {
  const roomName = `project:${projectId}`;

  const { user, remainingCount } = removeUserFromProjectRoom(projectId, socket.id);

  if (user) {
    socket.to(roomName).emit('userLeft', {
      projectId,
      userId: user.userId,
      userName: user.userName,
      timestamp: new Date().toISOString(),
    });
  }

  // Delete empty room immediately
  if (remainingCount === 0) {
    deleteEmptyProjectRoom(projectId);
  }

  socket.leave(roomName);
}

// 外部 API: 广播构建状态
export function broadcastBuildStatus(
  namespace: Namespace,
  projectId: number,
  status: 'pending' | 'running' | 'success' | 'failed',
  previewPort?: number,
  error?: string
): void {
  const roomName = `project:${projectId}`;
  namespace.to(roomName).emit('buildStatus', {
    projectId,
    status,
    previewPort,
    error,
    timestamp: new Date().toISOString(),
  });
}