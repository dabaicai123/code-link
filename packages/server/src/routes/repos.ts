// packages/server/src/routes/repos.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.ts';
import { RepoManager } from '../git/repo-manager.ts';
import { TokenManager } from '../git/token-manager.ts';
import type { ProjectRepo } from '../types.js';

export function createReposRouter(db: Database.Database): Router {
  const router = Router();
  const repoManager = new RepoManager(db);
  const tokenManager = new TokenManager(db);

  // 检查用户是否是项目成员
  function checkProjectMembership(userId: number, projectId: number): { isMember: boolean; role?: string } {
    const membership = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId) as { role: string } | undefined;

    return {
      isMember: !!membership,
      role: membership?.role,
    };
  }

  // 检查项目是否存在
  function projectExists(projectId: number): boolean {
    const project = db
      .prepare('SELECT id FROM projects WHERE id = ?')
      .get(projectId);
    return !!project;
  }

  // GET /api/repos/:projectId - 获取项目关联的仓库
  router.get('/:projectId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查项目是否存在
    if (!projectExists(projectId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目成员
    const { isMember } = checkProjectMembership(userId, projectId);
    if (!isMember) {
      res.status(403).json({ error: '无权访问该项目' });
      return;
    }

    const repos = repoManager.getProjectRepos(projectId);
    res.json(repos);
  });

  // POST /api/repos/:projectId/import - 导入仓库到项目
  router.post('/:projectId/import', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { repoUrl, branch, containerId } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!repoUrl || !branch || !containerId) {
      res.status(400).json({ error: '缺少必填字段：repoUrl, branch, containerId' });
      return;
    }

    // 检查项目是否存在
    if (!projectExists(projectId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目成员
    const { isMember, role } = checkProjectMembership(userId, projectId);
    if (!isMember) {
      res.status(403).json({ error: '无权访问该项目' });
      return;
    }

    // 只有 owner 和 developer 可以导入仓库
    if (role !== 'owner' && role !== 'developer') {
      res.status(403).json({ error: '只有 owner 或 developer 可以导入仓库' });
      return;
    }

    try {
      // 检测仓库提供商
      const provider = repoManager.detectProvider(repoUrl);

      // 检查用户是否已授权该提供商
      const hasToken = tokenManager.hasToken(userId, provider);
      if (!hasToken) {
        res.status(401).json({ error: `请先授权 ${provider}` });
        return;
      }

      // 在容器中克隆仓库
      const result = await repoManager.cloneRepo(containerId, repoUrl, branch, userId);

      if (!result.success) {
        res.status(500).json({ error: result.error || '克隆仓库失败' });
        return;
      }

      // 获取仓库名称
      const repoName = repoManager.extractRepoName(repoUrl);

      // 添加仓库关联
      repoManager.addRepoAssociation(projectId, provider, repoUrl, repoName, branch);

      const repo: ProjectRepo = {
        id: 0, // 新创建的，ID 由数据库生成
        project_id: projectId,
        provider,
        repo_url: repoUrl,
        repo_name: repoName,
        branch,
        created_at: new Date().toISOString(),
      };

      res.status(201).json({ ...repo, path: result.path });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/repos/:projectId/push - 推送代码到仓库
  router.post('/:projectId/push', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { repoUrl, branch, containerId, commitMessage } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!repoUrl || !branch || !containerId || !commitMessage) {
      res.status(400).json({ error: '缺少必填字段：repoUrl, branch, containerId, commitMessage' });
      return;
    }

    // 检查项目是否存在
    if (!projectExists(projectId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目成员
    const { isMember, role } = checkProjectMembership(userId, projectId);
    if (!isMember) {
      res.status(403).json({ error: '无权访问该项目' });
      return;
    }

    // 只有 owner 和 developer 可以推送代码
    if (role !== 'owner' && role !== 'developer') {
      res.status(403).json({ error: '只有 owner 或 developer 可以推送代码' });
      return;
    }

    try {
      // 检测仓库提供商
      const provider = repoManager.detectProvider(repoUrl);

      // 检查用户是否已授权该提供商
      const hasToken = tokenManager.hasToken(userId, provider);
      if (!hasToken) {
        res.status(401).json({ error: `请先授权 ${provider}` });
        return;
      }

      // 推送代码
      const result = await repoManager.pushRepo(containerId, repoUrl, branch, commitMessage, userId);

      if (!result.success) {
        res.status(500).json({ error: result.error || '推送代码失败' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/repos/:projectId - 移除仓库关联
  router.delete('/:projectId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoUrl = req.query.repoUrl;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json({ error: '缺少 repoUrl 参数' });
      return;
    }

    // 检查项目是否存在
    if (!projectExists(projectId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目成员
    const { isMember, role } = checkProjectMembership(userId, projectId);
    if (!isMember) {
      res.status(403).json({ error: '无权访问该项目' });
      return;
    }

    // 只有 owner 可以移除仓库关联
    if (role !== 'owner') {
      res.status(403).json({ error: '只有 owner 可以移除仓库关联' });
      return;
    }

    // 移除关联
    repoManager.removeRepoAssociation(projectId, repoUrl);

    res.status(204).send();
  });

  return router;
}
