import { singleton } from 'tsyringe';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('socket-server');

@singleton()
export class SocketServerService {
  private io: Server | null = null;

  create(httpServer: HttpServer): Server {
    if (this.io) return this.io;

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    logger.info('Socket.IO server created');
    return this.io;
  }

  getServer(): Server {
    if (!this.io) throw new Error('Socket server not initialized');
    return this.io;
  }

  close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}