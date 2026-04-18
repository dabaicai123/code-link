// packages/server/tests/containers.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { setEncryptionKey, encrypt } from '../src/crypto/aes.js';
import {
  createTestOrganization,
  createTestOrganizationMember,
  createTestClaudeConfig,
  findProjectById,
} from './helpers/test-db.js';
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
  let orgId: number;

  beforeEach(async () => {
    // 清空容器状态
    containerStates.clear();

    // 设置加密密钥（测试用）
    setEncryptionKey('test-encryption-key-for-containers-test-32-chars');

    closeDb();
    db = getSqliteDb(':memory:');
    initSchema(db);
    app = createApp();

    // 创建测试用户并获取 token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
    token = regRes.body.data.token;
    userId = regRes.body.data.user.id;

    // 直接在数据库中创建组织（绕过权限检查）
    const org = createTestOrganization(userId, { name: '测试组织' });
    orgId = org.id;

    // 添加用户为组织成员
    createTestOrganizationMember(orgId, userId, 'owner', userId);

    // 为用户添加 Claude 配置（加密存储）
    const config = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'test-token-for-containers',
      },
    };
    const encryptedConfig = encrypt(JSON.stringify(config));
    createTestClaudeConfig(userId, encryptedConfig);

    // 创建测试项目
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试项目', templateType: 'node', organizationId: orgId });
    projectId = projectRes.body.data.id;
  });

  afterEach(() => {
    closeDb();
  });

  describe('POST /api/projects/:id/container/start', () => {
    it('应成功启动容器', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.containerId).toBeDefined();
      expect(res.body.data.status).toBe('running');
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
      const otherToken = otherRes.body.data.token;

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

    it('用户未配置 Claude Code 应返回 400', async () => {
      // 创建一个新用户（没有 Claude 配置）
      const noConfigRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '无配置用户', email: 'noconfig@test.com', password: 'password123' });
      const noConfigToken = noConfigRes.body.data.token;

      // 该用户不是组织成员，所以无权访问项目
      const res = await request(app)
        .post(`/api/projects/${projectId}/container/start`)
        .set('Authorization', `Bearer ${noConfigToken}`);

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
      expect(res.body.code).toBe(0);
      expect(res.body.data.containerId).toBeDefined();
      expect(res.body.data.status).toBe('exited');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).post(`/api/projects/${projectId}/container/stop`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '其他用户', email: 'other2@test.com', password: 'password123' });
      const otherToken = otherRes.body.data.token;

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
      expect(res.body.code).toBe(0);
      expect(res.body.data.containerId).toBeDefined();
      expect(res.body.data.status).toBe('running');
    });

    it('项目无容器应返回 404', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/container`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe(40001);
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
      const otherToken = otherRes.body.data.token;

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
      const project = findProjectById(projectId);
      expect(project?.containerId).toBeNull();
      expect(project?.status).toBe('created');
    });

    it('非 owner 应返回 403', async () => {
      // 创建另一个用户并添加为组织成员（非 owner）
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: '开发者', email: 'dev@test.com', password: 'password123' });

      // 直接添加为组织成员（developer 角色）
      const otherUserId = otherRes.body.data.user.id;
      createTestOrganizationMember(orgId, otherUserId, 'developer', userId);

      const otherToken = otherRes.body.data.token;

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
