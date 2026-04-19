// packages/server/src/socket/index.ts
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createAuthMiddleware } from './middleware/auth.js';
import { setupProjectNamespace } from './namespaces/project.js';
import { setupDraftNamespace } from './namespaces/draft.js';
import { setupTerminalNamespace } from './namespaces/terminal.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('socket-server');

let ioInstance: Server | null = null;

export function createSocketServer(httpServer: HttpServer): Server {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // 全局认证中间件
  ioInstance.use(createAuthMiddleware());

  // 设置命名空间
  setupProjectNamespace(ioInstance.of('/project'));
  setupDraftNamespace(ioInstance.of('/draft'));
  setupTerminalNamespace(ioInstance.of('/terminal'));

  logger.info('Socket.IO server initialized');

  return ioInstance;
}

export function getSocketServer(): Server | null {
  return ioInstance;
}

export function closeSocketServer(): void {
  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
}

// 重置实例（用于测试）
export function resetSocketServerInstance(): void {
  ioInstance = null;
}

// 导出命名空间函数供外部使用
export { broadcastBuildStatus } from './namespaces/project.js';
export { broadcastDraftMessage, getDraftOnlineUsers } from './namespaces/draft.js';