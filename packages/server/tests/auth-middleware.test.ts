// packages/server/tests/auth-middleware.test.ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authMiddleware, JWT_SECRET } from '../src/middleware/auth.ts';
import { success } from '../src/utils/response.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json(success({ userId: (req as any).userId }));
  });
  return app;
}

describe('JWT 认证中间件', () => {
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
    const token = jwt.sign({ userId: 42 }, JWT_SECRET, { expiresIn: '24h' });
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
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });

  it('过期 token 应返回 401', async () => {
    const app = buildApp();
    const token = jwt.sign({ userId: 42 }, JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(30001);
    expect(res.body.error).toBe('请先登录');
  });
});