import "reflect-metadata";
process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { createApp } from '../../../src/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { setupTestDb, teardownTestDb } from '../../helpers/test-db.js';
import type { RateLimiterOptions } from '../../../src/modules/auth/auth.module.js';

// Real rate limiters for this test — inject via createApp options to bypass NODE_ENV=test skip
const testLimiterOptions: RateLimiterOptions = {
  authLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  loginLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { code: 'RATE_LIMIT', message: '登录尝试过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

describe('Auth rate limiting', () => {
  beforeEach(() => {
    resetConfig();
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    resetConfig();
  });

  it('should limit register attempts', async () => {
    const app = createApp(testLimiterOptions);

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: `test${i}@test.com`, password: 'test123' });
    }

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'test', email: 'test@test.com', password: 'test123' });

    expect(res.status).toBe(429);
  }, 30000);

  it('should limit login attempts', async () => {
    const app = createApp(testLimiterOptions);

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' });

    expect(res.status).toBe(429);
  }, 30000);
});