// packages/server/src/routes/repos.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { RepoManager } from '../git/repo-manager.js';
import { getContainerInfo } from '../docker/container-manager.js';

const logger = createLogger('repos');

export function createReposRouter(db: Database.Database): Router {
  const router = Router({ mergeParams: true });
  const repoManager = new RepoManager(db);

  // 解析仓库 URL
  function parseRepoUrl(url: string): { provider: 'github' | 'gitlab'; repoName: string } | null {
    try {
      const urlObj = new URL(url);

      let provider: 'github' | 'gitlab';
      if (urlObj.hostname === 'github.com') {
        provider = 'github';
      } else if (urlObj.hostname.includes('gitlab')) {
        provider = 'gitlab';
      } else {
        return null;
      }

      // 提取仓库名：/owner/repo.git 或 /owner/repo
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }

      const repoName = `${pathParts[0]}/${pathParts[1].replace('.git', '')}`;
      return { provider, repoName };
    } catch {
      return null;
    }
  }

  // 检查用户是否是项目成员
  function isProjectMember(projectId: number, userId: number): boolean {
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);
    return !!membership;
  }

  // 检查用户是否是项目 owner
  function isProjectOwner(projectId: number, userId: number): boolean {
    const membership = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId) as { role: string } | undefined;
    return membership?.role === 'owner';
  }

  // GET / - 获取项目的仓库列表
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    const repos = db
      .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE project_id = ?')
      .all(projectId);

    res.json(repos);
  });

  // POST / - 添加仓库到项目
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { url } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: '缺少仓库 URL' });
      return;
    }

    // 检查项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 解析 URL
    const parsed = parseRepoUrl(url);
    if (!parsed) {
      res.status(400).json({ error: '无效的仓库 URL，仅支持 GitHub 和 GitLab' });
      return;
    }

    try {
      const result = db
        .prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name) VALUES (?, ?, ?, ?)')
        .run(projectId, parsed.provider, url, parsed.repoName);

      const repo = db
        .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(repo);
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json({ error: '该仓库已添加到项目中' });
        return;
      }
      logger.error('添加仓库失败', error);
      res.status(500).json({ error: '添加仓库失败' });
    }
  });

  // DELETE /:repoId - 删除仓库
  router.delete('/:repoId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    // 检查项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查仓库是否属于该项目
    const repo = db
      .prepare('SELECT * FROM project_repos WHERE id = ? AND project_id = ?')
      .get(repoId, projectId);

    if (!repo) {
      res.status(404).json({ error: '仓库不存在' });
      return;
    }

    db.prepare('DELETE FROM project_repos WHERE id = ?').run(repoId);

    res.status(204).send();
  });

  // POST /:repoId/clone - Clone 仓库（仅 owner）
  router.post('/:repoId/clone', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    // 检查是否是 owner
    if (!isProjectOwner(projectId, userId)) {
      res.status(403).json({ error: '只有项目 owner 可以 clone 仓库' });
      return;
    }

    // 获取仓库信息
    const repo = db
      .prepare('SELECT * FROM project_repos WHERE id = ? AND project_id = ?')
      .get(repoId, projectId) as { repo_url: string } | undefined;

    if (!repo) {
      res.status(404).json({ error: '仓库不存在' });
      return;
    }

    // 获取项目信息（包含 container_id）
    const project = db
      .prepare('SELECT container_id FROM projects WHERE id = ?')
      .get(projectId) as { container_id: string | null } | undefined;

    if (!project || !project.container_id) {
      res.status(400).json({ error: '项目容器未启动' });
      return;
    }

    try {
      const result = await repoManager.cloneRepo(
        project.container_id,
        projectId,
        repo.repo_url,
        userId
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ path: result.path });
    } catch (error) {
      logger.error('Clone 失败', error);
      res.status(500).json({ error: 'Clone 失败' });
    }
  });

  // POST /:repoId/push - Push 仓库（仅 owner）
  router.post('/:repoId/push', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);
    const { message } = req.body;

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: '缺少 commit message' });
      return;
    }

    // 检查是否是 owner
    if (!isProjectOwner(projectId, userId)) {
      res.status(403).json({ error: '只有项目 owner 可以 push 仓库' });
      return;
    }

    // 获取仓库信息
    const repo = db
      .prepare('SELECT * FROM project_repos WHERE id = ? AND project_id = ?')
      .get(repoId, projectId) as { repo_url: string; branch: string } | undefined;

    if (!repo) {
      res.status(404).json({ error: '仓库不存在' });
      return;
    }

    // 获取项目信息
    const project = db
      .prepare('SELECT container_id FROM projects WHERE id = ?')
      .get(projectId) as { container_id: string | null } | undefined;

    if (!project || !project.container_id) {
      res.status(400).json({ error: '项目容器未启动' });
      return;
    }

    // 获取用户信息
    const user = db
      .prepare('SELECT name, email FROM users WHERE id = ?')
      .get(userId) as { name: string; email: string } | undefined;

    if (!user) {
      res.status(500).json({ error: '用户信息不存在' });
      return;
    }

    try {
      const result = await repoManager.pushRepo(
        project.container_id,
        projectId,
        repo.repo_url,
        repo.branch,
        message,
        userId,
        user.name,
        user.email
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Push 失败', error);
      res.status(500).json({ error: 'Push 失败' });
    }
  });

  return router;
}
