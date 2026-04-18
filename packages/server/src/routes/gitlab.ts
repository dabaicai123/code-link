// packages/server/src/routes/gitlab.ts
import { Router } from 'express';
import { getGitLabOAuthUrl, exchangeGitLabCode, getOAuthConfig } from '../git/oauth.js';
import { TokenManager } from '../git/token-manager.js';
import { GitLabClient } from '../git/gitlab-client.js';
import { success, Errors } from '../utils/response.js';

export function createGitLabRouter(): Router {
  const router = Router();
  const tokenManager = new TokenManager();

  // GET /api/gitlab/oauth - 获取 OAuth URL
  router.get('/oauth', (_req, res) => {
    const config = getOAuthConfig();
    const url = getGitLabOAuthUrl(config);
    res.json(success({ url }));
  });

  // POST /api/gitlab/oauth/callback - 处理 OAuth 回调
  router.post('/oauth/callback', async (req, res) => {
    const { code, userId } = req.body;

    if (!code || !userId) {
      res.status(400).json(Errors.paramMissing('code 或 userId'));
      return;
    }

    try {
      const config = getOAuthConfig();
      const tokenResponse = await exchangeGitLabCode(config, code);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      await tokenManager.saveToken(
        userId,
        'gitlab',
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt
      );

      res.json(success({ success: true }));
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  // GET /api/gitlab/projects - 获取用户的 GitLab 项目
  router.get('/projects', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    try {
      const config = getOAuthConfig();
      const client = new GitLabClient(config.gitlabBaseUrl, token.accessToken);
      const projects = await client.getUserProjects();
      res.json(success(projects));
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  // GET /api/gitlab/projects/:id - 获取单个项目详情
  router.get('/projects/:id', async (req, res) => {
    const userId = req.query.userId;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    try {
      const config = getOAuthConfig();
      const client = new GitLabClient(config.gitlabBaseUrl, token.accessToken);
      const project = await client.getProject(projectId);
      res.json(success(project));
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  // GET /api/gitlab/projects/:id/branches - 获取项目分支
  router.get('/projects/:id/branches', async (req, res) => {
    const userId = req.query.userId;
    const projectId = parseInt(req.params.id, 10);

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    try {
      const config = getOAuthConfig();
      const client = new GitLabClient(config.gitlabBaseUrl, token.accessToken);
      const branches = await client.getProjectBranches(projectId);
      res.json(success(branches));
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  // DELETE /api/gitlab/token - 删除 GitLab Token
  router.delete('/token', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    await tokenManager.deleteToken(Number(userId), 'gitlab');
    res.status(204).send();
  });

  // GET /api/gitlab/status - 检查 GitLab 授权状态
  router.get('/status', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    const hasToken = await tokenManager.hasToken(Number(userId), 'gitlab');
    res.json(success({ authorized: hasToken }));
  });

  return router;
}