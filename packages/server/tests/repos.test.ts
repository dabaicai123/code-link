// packages/server/tests/repos.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import { getDb } from '../src/db/connection.ts';
import { initSchema } from '../src/db/schema.ts';
import type Database from 'better-sqlite3';

describe('GitHub OAuth 路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;

  beforeEach(() => {
    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);
    vi.restoreAllMocks();
  });

  describe('GET /api/github/oauth', () => {
    it('应返回 GitHub OAuth URL', async () => {
      const res = await request(app).get('/api/github/oauth');
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.url).toContain('github.com');
    });
  });

  describe('POST /api/github/oauth/callback', () => {
    it('缺少 code 应返回 400', async () => {
      const res = await request(app)
        .post('/api/github/oauth/callback')
        .send({ userId: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('缺少');
    });

    it('缺少 userId 应返回 400', async () => {
      const res = await request(app)
        .post('/api/github/oauth/callback')
        .send({ code: 'test_code' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('缺少');
    });

    it('成功交换 token 应返回 success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'gh_token',
          refresh_token: 'gh_refresh',
          expires_in: 3600,
        }),
      });

      // 先创建用户
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      const res = await request(app)
        .post('/api/github/oauth/callback')
        .send({ code: 'test_code', userId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 验证 token 已保存
      const token = db.prepare('SELECT * FROM project_tokens WHERE user_id = 1 AND provider = ?').get('github');
      expect(token).toBeDefined();
    });

    it('交换失败应返回 500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const res = await request(app)
        .post('/api/github/oauth/callback')
        .send({ code: 'invalid_code', userId: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/github/repos', () => {
    it('缺少 userId 应返回 400', async () => {
      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(400);
    });

    it('未授权应返回 401', async () => {
      const res = await request(app).get('/api/github/repos?userId=1');
      expect(res.status).toBe(401);
    });

    it('成功应返回仓库列表', async () => {
      // 先创建用户并保存 token
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token) VALUES (?, ?, ?)').run(1, 'github', 'gh_token');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: 'repo1', full_name: 'user/repo1' },
          { id: 2, name: 'repo2', full_name: 'user/repo2' },
        ]),
      });

      const res = await request(app).get('/api/github/repos?userId=1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /api/github/status', () => {
    it('缺少 userId 应返回 400', async () => {
      const res = await request(app).get('/api/github/status');
      expect(res.status).toBe(400);
    });

    it('无 token 应返回 authorized: false', async () => {
      const res = await request(app).get('/api/github/status?userId=1');
      expect(res.status).toBe(200);
      expect(res.body.authorized).toBe(false);
    });

    it('有 token 应返回 authorized: true', async () => {
      // 先创建用户
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token) VALUES (?, ?, ?)').run(1, 'github', 'gh_token');

      const res = await request(app).get('/api/github/status?userId=1');
      expect(res.status).toBe(200);
      expect(res.body.authorized).toBe(true);
    });
  });

  describe('DELETE /api/github/token', () => {
    it('缺少 userId 应返回 400', async () => {
      const res = await request(app).delete('/api/github/token');
      expect(res.status).toBe(400);
    });

    it('应成功删除 token', async () => {
      // 先创建用户
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token) VALUES (?, ?, ?)').run(1, 'github', 'gh_token');

      const res = await request(app).delete('/api/github/token?userId=1');
      expect(res.status).toBe(204);

      const token = db.prepare('SELECT * FROM project_tokens WHERE user_id = 1 AND provider = ?').get('github');
      expect(token).toBeUndefined();
    });
  });
});

describe('GitLab OAuth 路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;

  beforeEach(() => {
    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);
    vi.restoreAllMocks();
  });

  describe('GET /api/gitlab/oauth', () => {
    it('应返回 GitLab OAuth URL', async () => {
      const res = await request(app).get('/api/gitlab/oauth');
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.url).toContain('gitlab.com');
    });
  });

  describe('POST /api/gitlab/oauth/callback', () => {
    it('缺少 code 应返回 400', async () => {
      const res = await request(app)
        .post('/api/gitlab/oauth/callback')
        .send({ userId: 1 });
      expect(res.status).toBe(400);
    });

    it('成功交换 token 应返回 success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'gl_token',
          refresh_token: 'gl_refresh',
          expires_in: 3600,
        }),
      });

      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      const res = await request(app)
        .post('/api/gitlab/oauth/callback')
        .send({ code: 'test_code', userId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const token = db.prepare('SELECT * FROM project_tokens WHERE user_id = 1 AND provider = ?').get('gitlab');
      expect(token).toBeDefined();
    });
  });

  describe('GET /api/gitlab/projects', () => {
    it('缺少 userId 应返回 400', async () => {
      const res = await request(app).get('/api/gitlab/projects');
      expect(res.status).toBe(400);
    });

    it('未授权应返回 401', async () => {
      const res = await request(app).get('/api/gitlab/projects?userId=1');
      expect(res.status).toBe(401);
    });

    it('成功应返回项目列表', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token) VALUES (?, ?, ?)').run(1, 'gitlab', 'gl_token');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: 'project1', path_with_namespace: 'user/project1' },
        ]),
      });

      const res = await request(app).get('/api/gitlab/projects?userId=1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /api/gitlab/status', () => {
    it('有 token 应返回 authorized: true', async () => {
      // 先创建用户
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'test', email: 'test@test.com', password: 'password123' });

      db.prepare('INSERT INTO project_tokens (user_id, provider, access_token) VALUES (?, ?, ?)').run(1, 'gitlab', 'gl_token');

      const res = await request(app).get('/api/gitlab/status?userId=1');
      expect(res.status).toBe(200);
      expect(res.body.authorized).toBe(true);
    });
  });
});

describe('Repos 路由', () => {
  let app: ReturnType<typeof createApp>;
  let db: Database.Database;
  let token: string;
  let userId: number;
  let projectId: number;

  beforeEach(async () => {
    db = getDb(':memory:');
    initSchema(db);
    app = createApp(db);
    vi.restoreAllMocks();

    // 创建用户
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'test', email: 'test@test.com', password: 'password123' });
    token = regRes.body.token;
    userId = regRes.body.user.id;

    // 创建项目
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'test-project', template_type: 'node' });
    projectId = projectRes.body.id;
  });

  describe('GET /api/projects/:projectId/repos', () => {
    it('应返回项目关联的仓库', async () => {
      // 添加仓库关联
      db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
        projectId, 'github', 'https://github.com/user/repo.git', 'repo', 'main'
      );

      const res = await request(app)
        .get(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].repo_name).toBe('repo');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/repos`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      // 创建另一个用户
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'other', email: 'other@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .get(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it('无效项目 ID 应返回 400', async () => {
      const res = await request(app)
        .get('/api/projects/invalid/repos')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('不存在项目应返回 404', async () => {
      const res = await request(app)
        .get('/api/projects/99999/repos')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:projectId/repos', () => {
    it('应成功添加 GitHub 仓库', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://github.com/owner/frontend' });

      expect(res.status).toBe(201);
      expect(res.body.repo_name).toBe('owner/frontend');
      expect(res.body.provider).toBe('github');
    });

    it('应成功添加 GitLab 仓库', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://gitlab.com/owner/backend.git' });

      expect(res.status).toBe(201);
      expect(res.body.repo_name).toBe('owner/backend');
      expect(res.body.provider).toBe('gitlab');
    });

    it('应拒绝无效的 URL', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://bitbucket.org/owner/repo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('仅支持 GitHub 和 GitLab');
    });

    it('缺少 URL 应返回 400', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('缺少仓库 URL');
    });

    it('未登录应返回 401', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'other', email: 'other@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.status).toBe(404);
    });

    it('重复仓库应返回 409', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://github.com/owner/frontend' });

      const res = await request(app)
        .post(`/api/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://github.com/owner/frontend' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('已添加');
    });
  });

  describe('DELETE /api/projects/:projectId/repos/:repoId', () => {
    let repoId: number;

    beforeEach(() => {
      // 添加仓库关联
      const result = db.prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)').run(
        projectId, 'github', 'https://github.com/user/repo.git', 'repo', 'main'
      );
      repoId = result.lastInsertRowid;
    });

    it('应成功删除仓库', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/repos/${repoId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const repo = db.prepare('SELECT * FROM project_repos WHERE id = ?').get(repoId);
      expect(repo).toBeUndefined();
    });

    it('未登录应返回 401', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/repos/${repoId}`);
      expect(res.status).toBe(401);
    });

    it('非项目成员应返回 404', async () => {
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'other', email: 'other@test.com', password: 'password123' });
      const otherToken = otherRes.body.token;

      const res = await request(app)
        .delete(`/api/projects/${projectId}/repos/${repoId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it('无效 repoId 应返回 400', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/repos/invalid`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('不存在的仓库应返回 404', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/repos/99999`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
