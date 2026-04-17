// packages/server/tests/builds.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/index.ts';
import { getDb, closeDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import { JWT_SECRET } from '../src/middleware/auth.ts';
import { resetBuildManagerInstance } from '../src/build/build-manager.ts';
import type Database from 'better-sqlite3';

// Mock Docker 相关依赖，避免异步构建时的错误
vi.mock('../src/docker/client.js', () => ({
  getDockerClient: vi.fn(() => ({
    buildImage: vi.fn(() => Promise.resolve({})),
    modem: {
      followProgress: vi.fn((stream, callback) => callback(null, [])),
    },
  })),
}));

vi.mock('../src/docker/volume-manager.js', () => ({
  getVolumePath: vi.fn((projectId: number) => `/volumes/project-${projectId}`),
}));

vi.mock('../src/build/preview-container.js', () => ({
  getPreviewContainerManager: vi.fn(() => ({
    createPreviewContainer: vi.fn(() => Promise.resolve(30001)),
    stopPreviewContainer: vi.fn(() => Promise.resolve()),
    getContainerInfo: vi.fn(() => undefined),
    getPreviewUrl: vi.fn((port: number) => `http://localhost:${port}`),
  })),
}));

vi.mock('../src/websocket/server.js', () => ({
  getWebSocketServer: vi.fn(() => null),
  resetWebSocketServerInstance: vi.fn(),
}));

describe('Builds API', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;
  let authToken: string;

  beforeEach(() => {
    db = getDb(':memory:');
    initSchema(db);

    // 创建测试用户
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
      'test',
      'test@test.com',
      'hash'
    );

    // 创建测试项目
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run(
      'test-project',
      'node',
      1
    );

    // 添加用户到项目
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
      1,
      1,
      'owner'
    );

    app = createApp(db);

    // 生成测试 token
    authToken = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '24h' });

    // 重置 BuildManager 单例
    resetBuildManagerInstance();
  });

  afterEach(() => {
    closeDb(db);
  });

  describe('POST /api/builds', () => {
    it('应成功创建构建', async () => {
      const res = await request(app)
        .post('/api/builds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.project_id).toBe(1);
      expect(res.body.status).toBe('pending');
    });

    it('缺少 projectId 应返回 400', async () => {
      const res = await request(app)
        .post('/api/builds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('无权限访问项目应返回 403', async () => {
      // 创建另一个用户
      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
        'other',
        'other@test.com',
        'hash'
      );
      const otherToken = jwt.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '24h' });

      const res = await request(app)
        .post('/api/builds')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ projectId: 1 });

      expect(res.status).toBe(403);
    });

    it('未认证应返回 401', async () => {
      const res = await request(app)
        .post('/api/builds')
        .send({ projectId: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/builds/project/:projectId', () => {
    it('应返回项目的构建列表', async () => {
      // 先创建构建
      await request(app)
        .post('/api/builds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 1 });

      const res = await request(app)
        .get('/api/builds/project/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].project_id).toBe(1);
    });

    it('无效的项目 ID 应返回 400', async () => {
      const res = await request(app)
        .get('/api/builds/project/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('无权限应返回 403', async () => {
      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
        'other',
        'other@test.com',
        'hash'
      );
      const otherToken = jwt.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '24h' });

      const res = await request(app)
        .get('/api/builds/project/1')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/builds/:id', () => {
    it('应返回构建详情', async () => {
      const createRes = await request(app)
        .post('/api/builds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 1 });

      const res = await request(app)
        .get(`/api/builds/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.project_id).toBe(1);
    });

    it('无效的构建 ID 应返回 400', async () => {
      const res = await request(app)
        .get('/api/builds/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('构建不存在应返回 404', async () => {
      const res = await request(app)
        .get('/api/builds/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('无权限应返回 403', async () => {
      const createRes = await request(app)
        .post('/api/builds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 1 });

      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
        'other',
        'other@test.com',
        'hash'
      );
      const otherToken = jwt.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '24h' });

      const res = await request(app)
        .get(`/api/builds/${createRes.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/builds/preview/:projectId', () => {
    it('预览容器未运行应返回 404', async () => {
      const res = await request(app)
        .get('/api/builds/preview/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('预览容器');
    });

    it('无效的项目 ID 应返回 400', async () => {
      const res = await request(app)
        .get('/api/builds/preview/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('无权限应返回 403', async () => {
      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
        'other',
        'other@test.com',
        'hash'
      );
      const otherToken = jwt.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '24h' });

      const res = await request(app)
        .get('/api/builds/preview/1')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/builds/preview/:projectId', () => {
    it('应成功停止预览容器', async () => {
      const res = await request(app)
        .delete('/api/builds/preview/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it('无效的项目 ID 应返回 400', async () => {
      const res = await request(app)
        .delete('/api/builds/preview/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('无权限应返回 403', async () => {
      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
        'other',
        'other@test.com',
        'hash'
      );
      const otherToken = jwt.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '24h' });

      const res = await request(app)
        .delete('/api/builds/preview/1')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
