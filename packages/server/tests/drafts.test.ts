// packages/server/tests/drafts.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import { getDb, closeDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import { createAuthRouter } from '../src/routes/auth.ts';
import { createDraftsRouter } from '../src/routes/drafts.ts';
import { authMiddleware } from '../src/middleware/auth.ts';
import type Database from 'better-sqlite3';
import type { Router } from 'express';

describe('草稿路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;

  beforeEach(() => {
    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);
  });

  afterEach(() => {
    closeDb(db);
  });

  // 辅助函数：注册并登录，返回 token
  async function registerAndLogin(
    name = '测试用户',
    email = 'test@test.com',
    password = 'password123'
  ): Promise<string> {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password });
    return res.body.token;
  }

  describe('POST /api/drafts', () => {
    it('应成功创建草稿', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '我的草稿',
          content: { blocks: [{ type: 'paragraph', data: { text: 'Hello' } }] },
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('我的草稿');
      expect(res.body.user_id).toBeDefined();
    });

    it('无认证应返回 401', async () => {
      const res = await request(app)
        .post('/api/drafts')
        .send({ title: '草稿', content: {} });

      expect(res.status).toBe(401);
    });

    it('缺少标题应返回 400', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: {} });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/drafts', () => {
    it('应返回用户的草稿列表', async () => {
      const token = await registerAndLogin();

      // 创建两个草稿
      await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '草稿1', content: { text: 'content1' } });
      await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '草稿2', content: { text: 'content2' } });

      const res = await request(app)
        .get('/api/drafts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBeDefined();
      expect(res.body[0]).not.toHaveProperty('content'); // 列表不返回 content
    });

    it('无认证应返回 401', async () => {
      const res = await request(app).get('/api/drafts');
      expect(res.status).toBe(401);
    });

    it('应只返回当前用户的草稿', async () => {
      // 用户1创建草稿
      const token1 = await registerAndLogin('用户1', 'user1@test.com');
      await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: '用户1的草稿', content: {} });

      // 用户2创建草稿
      const token2 = await registerAndLogin('用户2', 'user2@test.com', 'pass456');
      await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: '用户2的草稿', content: {} });

      // 用户1应只能看到自己的草稿
      const res = await request(app)
        .get('/api/drafts')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('用户1的草稿');
    });
  });

  describe('GET /api/drafts/:id', () => {
    it('应返回指定草稿详情', async () => {
      const token = await registerAndLogin();

      const createRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '测试草稿', content: { text: 'hello world' } });

      const draftId = createRes.body.id;

      const res = await request(app)
        .get(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('测试草稿');
      expect(res.body.content).toEqual({ text: 'hello world' });
    });

    it('访问他人草稿应返回 404', async () => {
      const token1 = await registerAndLogin('用户1', 'user1@test.com');
      const token2 = await registerAndLogin('用户2', 'user2@test.com', 'pass456');

      const createRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: '用户1的草稿', content: {} });

      const draftId = createRes.body.id;

      const res = await request(app)
        .get(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);
    });

    it('不存在的草稿应返回 404', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .get('/api/drafts/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/drafts/:id', () => {
    it('应成功更新草稿', async () => {
      const token = await registerAndLogin();

      const createRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '原标题', content: { text: '原内容' } });

      const draftId = createRes.body.id;

      const res = await request(app)
        .put(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '新标题', content: { text: '新内容' } });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('新标题');
    });

    it('更新他人草稿应返回 404', async () => {
      const token1 = await registerAndLogin('用户1', 'user1@test.com');
      const token2 = await registerAndLogin('用户2', 'user2@test.com', 'pass456');

      const createRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: '用户1的草稿', content: {} });

      const draftId = createRes.body.id;

      const res = await request(app)
        .put(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: '尝试修改' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/drafts/:id', () => {
    it('应成功删除草稿', async () => {
      const token = await registerAndLogin();

      const createRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '待删除', content: {} });

      const draftId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // 确认已删除
      const getRes = await request(app)
        .get(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });

    it('删除他人草稿应返回 404', async () => {
      const token1 = await registerAndLogin('用户1', 'user1@test.com');
      const token2 = await registerAndLogin('用户2', 'user2@test.com', 'pass456');

      const createRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: '用户1的草稿', content: {} });

      const draftId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);
    });
  });
});