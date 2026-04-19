// packages/server/src/socket/middleware/auth.ts
import type { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { createLogger } from '../../logger/index.js';

const logger = createLogger('socket-auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthSocketData {
  userId: number;
  userName: string;
}

declare module 'socket.io' {
  interface Socket {
    data: AuthSocketData;
  }
}

export function createAuthMiddleware() {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const decoded = verify(token, JWT_SECRET) as { userId: number; userName: string };

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
      logger.error('Socket authentication failed', error);
      next(new Error('Unauthorized: Invalid token'));
    }
  };
}