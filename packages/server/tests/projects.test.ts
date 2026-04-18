// packages/server/tests/projects.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import {
  createTestOrganization,
  createTestOrganizationMember,
  findProjectById,
} from './helpers/test-db.js';
describe('项目路由', () => {
  let app: ReturnType<typeof createApp>;
  let token: string;
  let userId: number;
  let orgId: number;

  beforeEach(async () => {
    closeDb();
    getSqliteDb(':memory:');
    initSchema(getSqliteDb());
    app = createApp();

    // 创建测试用户并获取 token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
    token = regRes.body.token;
    userId = regRes.body.user.id;

    // 直接在数据库中创建组织（绕过权限检查）
    const org = createTestOrganization(userId, { name: '测试组织' });
    orgId = org.id;

    // 添加用户为组织成员
    createTestOrganizationMember(orgId, userId, 'owner', userId);
  });

  afterEach(() => {
    closeDb();
  });

  describe('POST /api/projects', () => {
    it('应成功创建项目', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '测试项目', templateType: 'node', organizationId: orgId });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('测试项目');
      expect(res.body.templateType).toBe('node');
      expect(res.body.createdBy).toBe(userId);
      expect(res.body.id).toBeDefined();
    });

    it('无效模板类型应返回 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目', templateType: 'invalid', organizationId: orgId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('无效的模板类型');
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目', organizationId: orgId });
      expect(res.status).toBe(400);
    });

    it('未登录应返回 401', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: '项目', templateType: 'node', organizationId: orgId });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects', () => {
    it('应返回用户参与的所有项目', async () => {
      // 创建两个项目
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目1', templateType: 'node', organizationId: orgId });
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '项目2', templateType: 'node+python', organizationId: orgId });

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
        .send({ name: '我的项目', templateType: 'node', organizationId: orgId });

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
        .send({ name: '详情项目', templateType: 'node', organizationId: orgId });
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

    it('非项目成员应返回 403', async () => {
      // 创建另一个用户
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other2@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let projectId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '待删除项目', templateType: 'node', organizationId: orgId });
      projectId = res.body.id;
    });

    it('owner 应成功删除项目', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      // 验证项目已删除
      const project = findProjectById(projectId);
      expect(project).toBeUndefined();
    });

    it('非 owner 应返回 403', async () => {
      // 创建另一个用户并将其添加为组织 developer
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '开发者', email: 'dev@test.com', password: 'password123' });
      const otherUserId = otherRes.body.user.id;
      const otherToken = otherRes.body.token;

      // 添加为组织 developer
      createTestOrganizationMember(orgId, otherUserId, 'developer', userId);

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