// packages/server/tests/socket/middleware/auth.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuthMiddleware } from '../../../src/socket/middleware/auth.js';
import { resetConfig } from '../../../src/core/config.js';

describe('Socket auth middleware', () => {
  beforeEach(() => {
    resetConfig();
    process.env.JWT_SECRET = 'socket-test-secret-key-32-characters!';
  });

  afterEach(() => {
    resetConfig();
  });

  it('should use getConfig() for JWT secret', async () => {
    const middleware = createAuthMiddleware();
    const mockSocket = {
      handshake: { auth: { token: 'invalid' }, headers: {} },
      data: {},
    };
    const mockNext = vi.fn();

    // Middleware should reject invalid token using getConfig()
    await middleware(mockSocket as any, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    expect(mockNext.mock.calls[0][0].message).toContain('Unauthorized');
  });
});
