// packages/server/src/socket/index.ts
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { container } from 'tsyringe';
import { SocketServerService } from './socket-server.service.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { setupProjectNamespace } from './namespaces/project.js';
import { setupDraftNamespace } from './namespaces/draft.js';
import { setupTerminalNamespace } from './namespaces/terminal.js';
import { setupCleanupInterval, stopCleanupInterval } from './utils/room-manager.js';
import { startExecutionCleanup, stopExecutionCleanup } from '../ai/execution-manager.js';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('socket-server');

// In-memory rate limiting for socket connections (request-level state, not DI)
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 connections per minute per IP

let rateLimitCleanupInterval: NodeJS.Timeout | null = null;

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

function startRateLimitCleanup(): void {
  if (rateLimitCleanupInterval) return;

  rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of connectionAttempts.entries()) {
      if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
        connectionAttempts.delete(ip);
      }
    }
  }, RATE_LIMIT_WINDOW);
}

function stopRateLimitCleanup(): void {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
  connectionAttempts.clear();
}

export function createSocketServer(httpServer: HttpServer): Server {
  const socketService = container.resolve(SocketServerService);
  const io = socketService.create(httpServer);

  // Connection rate limiting middleware
  io.use((socket, next) => {
    const ip = socket.handshake.address || 'unknown';
    if (!checkConnectionRateLimit(ip)) {
      return next(new Error('Connection rate limit exceeded'));
    }
    next();
  });

  // Global auth middleware
  io.use(createAuthMiddleware());

  // Setup namespaces
  setupProjectNamespace(io.of('/project'));
  setupDraftNamespace(io.of('/draft'));
  setupTerminalNamespace(io.of('/terminal'));

  // Start TTL cleanup for empty rooms and execution sessions
  setupCleanupInterval();
  startExecutionCleanup();

  // Start rate-limit entry cleanup
  startRateLimitCleanup();

  logger.info('Socket.IO server initialized');

  return io;
}

export function closeSocketServer(): void {
  stopCleanupInterval();
  stopExecutionCleanup();
  stopRateLimitCleanup();
  const socketService = container.resolve(SocketServerService);
  socketService.close();
}

// Reset for tests: clear rate-limit data and reset the SocketServerService instance
export function resetSocketServerInstance(): void {
  stopRateLimitCleanup();
  connectionAttempts.clear();
  const socketService = container.resolve(SocketServerService);
  socketService.close();
}

// Export namespace functions for external use
export { broadcastBuildStatus } from './namespaces/project.js';
export { broadcastDraftMessage, getDraftOnlineUsers } from './namespaces/draft.js';