// packages/server/src/socket/middleware/auth.ts
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
const { verify } = jwt;
import { normalizeError } from '../../core/errors/index.js';
import { createLogger } from '../../core/logger/index.js';
import { getConfig } from '../../core/config.js';
import type { SocketData } from '../types.js';

const logger = createLogger('socket-auth');

// Re-export for compatibility
export type AuthSocketData = SocketData;

export function createAuthMiddleware() {
  const config = getConfig();
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const decoded = verify(token, config.jwtSecret) as { userId: number; userName: string };

      if (!decoded.userId || !decoded.userName) {
        return next(new Error('Unauthorized: Invalid token payload'));
      }

      socket.data = {
        userId: decoded.userId,
        userName: decoded.userName,
      };

      logger.debug(`Socket authenticated: userId=${decoded.userId}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed', normalizeError(error));
      next(new Error('Unauthorized: Invalid token'));
    }
  };
}