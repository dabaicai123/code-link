// Set JWT_SECRET before any imports that use tsyringe DI
process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { resetConfig } from '../src/core/config.js';
import { setupTestDb, teardownTestDb } from './helpers/test-db.js';

describe('Auth rate limiting', () => {
  beforeEach(() => {
    resetConfig();
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    resetConfig();
  });

  it('should limit login attempts', async () => {
    const app = createApp();

    // Make multiple failed login attempts
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
    }

    // The 11th attempt should be rate limited
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' });

    expect(res.status).toBe(429);
  }, 30000);

  it('should limit register attempts', async () => {
    const app = createApp();

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
});
