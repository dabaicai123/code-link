// packages/server/src/routes/gitlab.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getGitLabOAuthUrl, exchangeGitLabCode, getOAuthConfig } from '../git/oauth.ts';
import { TokenManager } from '../git/token-manager.ts';
import { GitLabClient } from '../git/gitlab-client.ts';

export function createGitLabRouter(db: Database.Database): Router {
  const router = Router();
  const tokenManager = new TokenManager(db);

  // GET /api/gitlab/oauth - 获取 OAuth URL
  router.get('/oauth', (_req, res) => {
    const config = getOAuthConfig();
    const url = getGitLabOAuthUrl(config);
    res.json({ url });
  });

  // POST /api/gitlab/oauth/callback - 处理 OAuth 回调
  router.post('/oauth/callback', async (req, res) => {
    const { code, userId } = req.body;

    if (!code || !userId) {
      res.status(400).json({ error: '缺少 code 或 userId' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const tokenResponse = await exchangeGitLabCode(config, code);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      tokenManager.saveToken(
        userId,
        'gitlab',
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/gitlab/projects - 获取用户的 GitLab 项目
  router.get('/projects', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const token = tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json({ error: '未授权 GitLab' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const client = new GitLabClient(config.gitlabBaseUrl, token.access_token);
      const projects = await client.getUserProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/gitlab/projects/:id - 获取单个项目详情
  router.get('/projects/:id', async (req, res) => {
    const userId = req.query.userId;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    const token = tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json({ error: '未授权 GitLab' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const client = new GitLabClient(config.gitlabBaseUrl, token.access_token);
      const project = await client.getProject(projectId);
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/gitlab/projects/:id/branches - 获取项目分支
  router.get('/projects/:id/branches', async (req, res) => {
    const userId = req.query.userId;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    const token = tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json({ error: '未授权 GitLab' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const client = new GitLabClient(config.gitlabBaseUrl, token.access_token);
      const branches = await client.getProjectBranches(projectId);
      res.json(branches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/gitlab/token - 删除 GitLab Token
  router.delete('/token', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    tokenManager.deleteToken(Number(userId), 'gitlab');
    res.status(204).send();
  });

  // GET /api/gitlab/status - 检查 GitLab 授权状态
  router.get('/status', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const hasToken = tokenManager.hasToken(Number(userId), 'gitlab');
    res.json({ authorized: hasToken });
  });

  return router;
}
