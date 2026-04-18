// packages/server/tests/server.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';

describe('Express 服务器', () => {
  afterEach(() => {
    closeDb();
  });

  it('GET /api/health 应返回 200', async () => {
    closeDb();
    const db = getSqliteDb(':memory:');
    initSchema(db);
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('未知路由应返回 404', async () => {
    const db = getSqliteDb(':memory:');
    initSchema(db);
    const app = createApp();
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});