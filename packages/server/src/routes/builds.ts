// packages/server/src/routes/builds.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { getBuildManager } from '../build/build-manager.js';
import { getPreviewContainerManager } from '../build/preview-container.js';

const logger = createLogger('builds');

export function createBuildsRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/builds - 创建构建
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json({ error: '缺少 projectId' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    try {
      const buildManager = getBuildManager(db);
      const build = await buildManager.createBuild(projectId);

      // 异步启动构建（不等待）
      buildManager.startBuild(projectId, build.id).catch((error) => {
        logger.error('Build failed', error);
      });

      res.status(201).json(build);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/builds/project/:projectId - 获取项目的构建列表
  router.get('/project/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.projectId;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const buildManager = getBuildManager(db);
    const builds = buildManager.getProjectBuilds(projectId);

    res.json(builds);
  });

  // GET /api/builds/:id - 获取构建详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const buildId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(buildId)) {
      res.status(400).json({ error: '无效的构建 ID' });
      return;
    }

    const buildManager = getBuildManager(db);
    const build = buildManager.getBuild(buildId);

    if (!build) {
      res.status(404).json({ error: '构建不存在' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(build.project_id, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此构建' });
      return;
    }

    res.json(build);
  });

  // GET /api/builds/preview/:projectId - 获取项目预览 URL
  router.get('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.projectId;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const previewManager = getPreviewContainerManager();
    const containerInfo = previewManager.getContainerInfo(projectId.toString());

    if (!containerInfo) {
      res.status(404).json({ error: '预览容器未运行' });
      return;
    }

    res.json({
      url: previewManager.getPreviewUrl(containerInfo.port),
      port: containerInfo.port,
    });
  });

  // DELETE /api/builds/preview/:projectId - 停止预览容器
  router.delete('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.projectId;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const previewManager = getPreviewContainerManager();
    await previewManager.stopPreviewContainer(projectId.toString());

    res.status(204).send();
  });

  return router;
}
