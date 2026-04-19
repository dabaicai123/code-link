// packages/server/tests/auth-middleware.test.ts
import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/middleware/auth.ts';
import { success } from '../src/utils/response.js';
import { getConfig, resetConfig } from '../src/core/config.js';

const TEST_SECRET = 'test-secret-key-must-be-32-characters!';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json(success({ userId: req.userId }));
  });
  return app;
}

describe('JWT 认证中间件', () => {
  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    container.reset();
    resetConfig();
  });

  it('无 token 应返回 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });

  it('无效 token 应返回 401', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });

  it('有效 token 应通过并设置 userId', async () => {
    const app = buildApp();
    const config = getConfig();
    const token = jwt.sign({ userId: 42 }, config.jwtSecret, { expiresIn: '24h' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.userId).toBe(42);
  });

  it('空 Bearer token 应返回 401', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });

  it('payload 无 userId 应返回 401', async () => {
    const app = buildApp();
    const config = getConfig();
    const token = jwt.sign({ admin: true }, config.jwtSecret, { expiresIn: '24h' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });

  it('过期 token 应返回 401', async () => {
    const app = buildApp();
    const config = getConfig();
    const token = jwt.sign({ userId: 42 }, config.jwtSecret, { expiresIn: '-1s' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });
});