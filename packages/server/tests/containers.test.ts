// packages/server/tests/containers.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import { getDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import type Database from 'better-sqlite3';

// 存储容器状态
const containerStates: Map<string, string> = new Map();

// Mock container-manager.ts
vi.mock('../src/docker/container-manager.ts', () => ({
  createProjectContainer: vi.fn().mockImplementation(async () => {
    const containerId = 'test-container-id';
    containerStates.set(containerId, 'created');
    return containerId;
  }),
  startContainer: vi.fn().mockImplementation(async (containerId: string) => {
    containerStates.set(containerId, 'running');
  }),
  stopContainer: vi.fn().mockImplementation(async (containerId: string) => {
    containerStates.set(containerId, 'exited');
  }),
  removeContainer: vi.fn().mockResolvedValue(undefined),
  getContainerStatus: vi.fn().mockImplementation(async (containerId: string) => {
    return containerStates.get(containerId) || 'created';
  }),
  getProjectContainer: vi.fn().mockResolvedValue(null),
}));

// Mock volume-manager.ts
vi.mock('../src/docker/volume-manager.ts', () => ({
  createProjectVolume: vi.fn().mockResolvedValue('/workspace/project-1'),
  removeProjectVolume: vi.fn().mockResolvedValue(undefined),
  volumeExists: vi.fn().mockResolvedValue(false),
}));

describe('容器路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;
  let token: string;
  let userId: number;
  let projectId: number;

  beforeEach(async () => {
    // 清空容器状态
    containerStates.clear();

    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);

    // 创建测试用户并获取 token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
    token = regRes.body.token;
    userId = regRes.body.user.id;

    // 创建测试项目
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试项目', template_type: 'node' });
    projectId = projectRes.body.id;
  });

  describe('POST /api/projects/:id/container/start', () => {
    it('应成功启动容器', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.container_id).toBeDefined();
      expect(res.body.status).toBe('running');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).post(`/api/projects/${projectId}/container/start`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      // 创建另一个用户
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it('不存在的项目应返回 404', async () => {
      const res = await request(app)
        .post('/api/projects/99999/container/start')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/container/stop', () => {
    it('应成功停止容器', async () => {
      // 先启动容器
      await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/projects/${projectId}/container/stop`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.container_id).toBeDefined();
      expect(res.body.status).toBe('exited');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).post(`/api/projects/${projectId}/container/stop`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other2@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .post(`/api/projects/${projectId}/container/stop`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/container', () => {
    it('应返回容器状态', async () => {
      // 先启动容器
      await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get(`/api/projects/${projectId}/container`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.container_id).toBeDefined();
      expect(res.body.status).toBe('running');
    });

    it('项目无容器应返回 404', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/container`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('容器不存在');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/container`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other3@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .get(`/api/projects/${projectId}/container`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id/container', () => {
    it('owner 应成功删除容器和卷', async () => {
      // 先启动容器
      await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .delete(`/api/projects/${projectId}/container`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      // 验证项目状态已更新
      const project = db.prepare('SELECT container_id, status FROM projects WHERE id = ?').get(projectId) as {
        container_id: string | null;
        status: string;
      };
      expect(project.container_id).toBeNull();
      expect(project.status).toBe('created');
    });

    it('非 owner 应返回 403', async () => {
      // 创建另一个用户并添加为 developer
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '开发者', email: 'dev@test.com', password: 'password123' });
      const otherUserId = otherRes.body.user.id;
      const otherToken = otherRes.body.token;

      db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
        projectId,
        otherUserId,
        'developer'
      );

      const res = await request(app)
        .delete(`/api/projects/${projectId}/container`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).delete(`/api/projects/${projectId}/container`);
      expect(res.status).toBe(401);
    });
  });
});