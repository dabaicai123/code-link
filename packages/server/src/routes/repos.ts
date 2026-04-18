// packages/server/src/routes/repos.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('repos');

export function createReposRouter(db: Database.Database): Router {
  const router = Router({ mergeParams: true });

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

      const repoName = pathParts[1].replace('.git', '');
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

  return router;
}
