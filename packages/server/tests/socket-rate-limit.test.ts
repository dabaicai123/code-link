// packages/server/tests/socket-rate-limit.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { resetConfig } from '../src/core/config.js';
import { setupTestDb, teardownTestDb, createTestUser } from './helpers/test-db.js';

// Set JWT_SECRET before any imports that use tsyringe DI
process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

describe('Socket connection rate limiting', () => {
  let httpServer: ReturnType<typeof createServer>;
  let serverPort: number;
  let createSocketServer: typeof import('../src/socket/index.js').createSocketServer;
  let resetSocketServerInstance: typeof import('../src/socket/index.js').resetSocketServerInstance;
  let authToken: string;

  beforeEach(async () => {
    resetConfig();
    setupTestDb();

    // Create a test user and generate valid JWT token
    const user = createTestUser({ name: 'Test User', email: 'test@example.com' });
    authToken = jwt.sign(
      { userId: user.id, userName: user.name },
      process.env.JWT_SECRET!
    );

    // Dynamic import after JWT_SECRET is set and DB is ready
    const socketModule = await import('../src/socket/index.js');
    createSocketServer = socketModule.createSocketServer;
    resetSocketServerInstance = socketModule.resetSocketServerInstance;

    resetSocketServerInstance();

    httpServer = createServer();
    createSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(() => {
    httpServer.close();
    resetSocketServerInstance();
    teardownTestDb();
    resetConfig();
  });

  it('should limit rapid socket connections', async () => {
    const connections = [];

    // Attempt multiple rapid connections with valid tokens
    for (let i = 0; i < 20; i++) {
      const socket = ioClient(`http://localhost:${serverPort}`, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token: authToken },
      });
      connections.push(socket);
    }

    // Wait for connections to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Most connections should fail due to rate limiting
    const failedConnections = connections.filter(s => !s.connected);
    expect(failedConnections.length).toBeGreaterThan(5);

    // Cleanup
    connections.forEach(s => s.disconnect());
  }, 10000);
});
