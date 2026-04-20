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

// In-memory rate limiting for socket connections
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 connections per minute per IP

function checkConnectionRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempts = connectionAttempts.get(ip);

  if (!attempts) {
    connectionAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }

  if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
    connectionAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }

  if (attempts.count >= RATE_LIMIT_MAX) {
    return false;
  }

  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of connectionAttempts.entries()) {
    if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
      connectionAttempts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

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

  // Connection rate limiting middleware
  ioInstance.use((socket, next) => {
    const ip = socket.handshake.address || 'unknown';
    if (!checkConnectionRateLimit(ip)) {
      return next(new Error('Connection rate limit exceeded'));
    }
    next();
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
  connectionAttempts.clear();
}

// 导出命名空间函数供外部使用
export { broadcastBuildStatus } from './namespaces/project.js';
export { broadcastDraftMessage, getDraftOnlineUsers } from './namespaces/draft.js';