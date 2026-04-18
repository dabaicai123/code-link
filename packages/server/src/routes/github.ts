// packages/server/src/routes/github.ts
import { Router } from 'express';
import { getGitHubOAuthUrl, exchangeGitHubCode, getOAuthConfig } from '../git/oauth.js';
import { TokenManager } from '../git/token-manager.js';
import { GitHubClient } from '../git/github-client.js';

export function createGitHubRouter(): Router {
  const router = Router();
  const tokenManager = new TokenManager();

  // GET /api/github/oauth - 获取 OAuth URL
  router.get('/oauth', (_req, res) => {
    const config = getOAuthConfig();
    const url = getGitHubOAuthUrl(config);
    res.json({ url });
  });

  // POST /api/github/oauth/callback - 处理 OAuth 回调
  router.post('/oauth/callback', async (req, res) => {
    const { code, userId } = req.body;

    if (!code || !userId) {
      res.status(400).json({ error: '缺少 code 或 userId' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const tokenResponse = await exchangeGitHubCode(config, code);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      await tokenManager.saveToken(
        userId,
        'github',
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/github/repos - 获取用户的 GitHub 仓库
  router.get('/repos', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'github');
    if (!token) {
      res.status(401).json({ error: '未授权 GitHub' });
      return;
    }

    try {
      const client = new GitHubClient(token.accessToken);
      const repos = await client.getUserRepos();
      res.json(repos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/github/repos/:owner/:repo - 获取单个仓库详情
  router.get('/repos/:owner/:repo', async (req, res) => {
    const userId = req.query.userId;
    const { owner, repo } = req.params;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'github');
    if (!token) {
      res.status(401).json({ error: '未授权 GitHub' });
      return;
    }

    try {
      const client = new GitHubClient(token.accessToken);
      const repoInfo = await client.getRepo(owner, repo);
      res.json(repoInfo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/github/repos/:owner/:repo/branches - 获取仓库分支
  router.get('/repos/:owner/:repo/branches', async (req, res) => {
    const userId = req.query.userId;
    const { owner, repo } = req.params;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'github');
    if (!token) {
      res.status(401).json({ error: '未授权 GitHub' });
      return;
    }

    try {
      const client = new GitHubClient(token.accessToken);
      const branches = await client.getRepoBranches(owner, repo);
      res.json(branches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/github/webhooks - 创建 Webhook
  router.post('/webhooks', async (req, res) => {
    const { userId, owner, repo, webhookUrl } = req.body;

    if (!userId || !owner || !repo || !webhookUrl) {
      res.status(400).json({ error: '缺少必填参数' });
      return;
    }

    const token = await tokenManager.getToken(Number(userId), 'github');
    if (!token) {
      res.status(401).json({ error: '未授权 GitHub' });
      return;
    }

    try {
      const client = new GitHubClient(token.accessToken);
      const webhook = await client.createWebhook(owner, repo, webhookUrl);
      res.status(201).json(webhook);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/github/token - 删除 GitHub Token
  router.delete('/token', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    await tokenManager.deleteToken(Number(userId), 'github');
    res.status(204).send();
  });

  // GET /api/github/status - 检查 GitHub 授权状态
  router.get('/status', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const hasToken = await tokenManager.hasToken(Number(userId), 'github');
    res.json({ authorized: hasToken });
  });

  return router;
}