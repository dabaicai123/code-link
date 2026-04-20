// Set JWT_SECRET before any imports that use tsyringe DI
process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { resetConfig } from '../src/core/config.js';

describe('CORS configuration', () => {
  beforeEach(() => {
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
  });

  afterEach(() => {
    resetConfig();
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGINS;
    delete process.env.NODE_ENV;
  });

  it('should allow requests from configured origin', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const app = createApp();

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('should reject requests from unknown origins', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const app = createApp();

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://malicious-site.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should support multiple origins in production', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:3000,https://app.example.com';
    process.env.NODE_ENV = 'production';
    const app = createApp();

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://app.example.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });
});