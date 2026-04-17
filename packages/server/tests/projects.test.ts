// packages/server/tests/projects.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import { getDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import type Database from 'better-sqlite3';

describe('项目路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;
  let token: string;
  let userId: number;

  beforeEach(async () => {
    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);

    // 创建测试用户并获取 token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
    token = regRes.body.token;
    userId = regRes.body.user.id;
  });

  describe('POST /api/projects', () => {
    it('应成功创建项目', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '测试项目', template_type: 'node' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('测试项目');
      expect(res.body.template_type).toBe('node');
      expect(res.body.created_by).toBe(userId);
      expect(res.body.id).toBeDefined();
    });

    it('创建项目时应自动添加创建者为 owner', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '新项目', template_type: 'node+java' });
      expect(res.status).toBe(201);

      // 检查成员表
      const member = db
        .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(res.body.id, userId) as { role: string } | undefined;
      expect(member).toBeDefined();
      expect(member?.role).toBe('owner');
    });

    it('无效模板类型应返回 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目', template_type: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('无效的模板类型');
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目' });
      expect(res.status).toBe(400);
    });

    it('未登录应返回 401', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: '项目', template_type: 'node' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects', () => {
    it('应返回用户参与的所有项目', async () => {
      // 创建两个项目
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目1', template_type: 'node' });
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目2', template_type: 'node+python' });

      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((p: any) => p.name)).toContain('项目1');
      expect(res.body.map((p: any) => p.name)).toContain('项目2');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });

    it('不应返回用户未参与的项目', async () => {
      // 创建一个项目
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '我的项目', template_type: 'node' });

      // 创建另一个用户
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      // 其他用户查询项目列表
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/projects/:id', () => {
    let projectId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '详情项目', template_type: 'node' });
      projectId = res.body.id;
    });

    it('应返回项目详情和成员列表', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('详情项目');
      expect(res.body.members).toBeDefined();
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].role).toBe('owner');
      expect(res.body.members[0].email).toBe('test@test.com');
    });

    it('不存在的项目应返回 404', async () => {
      const res = await request(app)
        .get('/api/projects/99999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).get(`/api/projects/${projectId}`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      // 创建另一个用户
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other2@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let projectId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '待删除项目', template_type: 'node' });
      projectId = res.body.id;
    });

    it('owner 应成功删除项目', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      // 验证项目已删除
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      expect(project).toBeUndefined();
    });

    it('非 owner 应返回 403', async () => {
      // 创建另一个用户并将其添加为 developer
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '开发者', email: 'dev@test.com', password: 'password123' });
      const otherUserId = otherRes.body.user.id;
      const otherToken = otherRes.body.token;

      // 添加为 developer
      db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
        projectId,
        otherUserId,
        'developer'
      );

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).delete(`/api/projects/${projectId}`);
      expect(res.status).toBe(401);
    });

    it('不存在的项目应返回 403（因为不是 owner）', async () => {
      const res = await request(app)
        .delete('/api/projects/99999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});