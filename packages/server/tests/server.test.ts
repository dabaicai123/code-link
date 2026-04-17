// packages/server/tests/server.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import { getDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';

describe('Express 服务器', () => {
  it('GET /api/health 应返回 200', async () => {
    const db = getDb(':memory:');
    initSchema(db);
    const app = createApp(db);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('未知路由应返回 404', async () => {
    const db = getDb(':memory:');
    initSchema(db);
    const app = createApp(db);
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
