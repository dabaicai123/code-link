// packages/server/tests/server.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { DatabaseConnection, createSqliteDb, initSchema } from '../src/db/index.js';
import { container } from 'tsyringe';

describe('Express 服务器', () => {
  let dbConnection: DatabaseConnection | null = null;

  afterEach(() => {
    container.reset();
    if (dbConnection) {
      dbConnection.close();
      dbConnection = null;
    }
  });

  it('GET /api/health 应返回 200', async () => {
    const sqlite = createSqliteDb(':memory:');
    initSchema(sqlite);
    dbConnection = DatabaseConnection.fromSqlite(sqlite);
    container.registerInstance(DatabaseConnection, dbConnection);

    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 0, data: { status: 'ok' } });
  });

  it('未知路由应返回 404', async () => {
    const sqlite = createSqliteDb(':memory:');
    initSchema(sqlite);
    dbConnection = DatabaseConnection.fromSqlite(sqlite);
    container.registerInstance(DatabaseConnection, dbConnection);

    const app = createApp();
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});