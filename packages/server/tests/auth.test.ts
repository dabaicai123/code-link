// packages/server/tests/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import { getDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import type Database from 'better-sqlite3';

describe('认证路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;

  beforeEach(() => {
    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);
  });

  describe('POST /api/auth/register', () => {
    it('应成功注册新用户', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe('测试用户');
      expect(res.body.user.email).toBe('test@test.com');
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('缺少字段应返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '测试' });
      expect(res.status).toBe(400);
    });

    it('重复邮箱应返回 409', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: '用户1', email: 'dup@test.com', password: 'pass123' });
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '用户2', email: 'dup@test.com', password: 'pass456' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: '登录用户', email: 'login@test.com', password: 'mypassword' });
    });

    it('正确凭据应返回 token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'mypassword' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@test.com');
    });

    it('错误密码应返回 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('不存在的邮箱应返回 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@test.com', password: 'whatever' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('携带有效 token 应返回用户信息', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Me测试', email: 'me@test.com', password: 'pass123' });
      const token = regRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@test.com');
    });
  });
});