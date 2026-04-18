// packages/server/tests/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getSqliteDb, closeDb, initSchema } from '../src/db/index.js';
import { createAuthRouter } from '../src/routes/auth.js';
import type Database from 'better-sqlite3';

describe('认证路由', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    // 关闭现有数据库连接，重置单例
    closeDb();
    // 创建新的内存数据库
    db = getSqliteDb(':memory:');
    initSchema(db);
    // 创建独立的 Express 应用
    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter());
  });

  afterEach(() => {
    closeDb();
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

    it('无 token 应返回 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('无效 token 应返回 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/login 缺少字段', () => {
    it('缺少 email 应返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'pass123' });
      expect(res.status).toBe(400);
    });

    it('缺少 password 应返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
    });
  });
});