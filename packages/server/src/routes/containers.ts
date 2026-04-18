import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { createProjectContainer, startContainer, stopContainer, removeContainer, getContainerStatus, getProjectContainer } from '../docker/container-manager.js';
import { createProjectVolume, removeProjectVolume } from '../docker/volume-manager.js';
import type { Project } from '../types.js';

const logger = createLogger('containers');

export function createContainersRouter(db: Database.Database): Router {
  const router = Router();

  // 辅助函数：检查用户是否是项目成员
  function isProjectMember(projectId: number, userId: number): boolean {
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);
    return !!membership;
  }

  // 辅助函数：检查用户是否是项目 owner
  function isProjectOwner(projectId: number, userId: number): boolean {
    const membership = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId) as { role: string } | undefined;
    return membership?.role === 'owner';
  }

  // 辅助函数：获取项目信息
  function getProject(projectId: number): Project | undefined {
    return db
      .prepare('SELECT id, name, template_type, container_id, status, github_repo, created_by, created_at FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;
  }

  // POST /api/projects/:id/container/start - 启动容器
  router.post('/:id/container/start', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查用户是否是项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 获取项目信息
    const project = getProject(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    try {
      let containerId = project.container_id;

      // 如果容器不存在，创建容器
      if (!containerId) {
        // 创建持久化卷
        await createProjectVolume(projectId);

        // 创建容器
        containerId = await createProjectContainer(projectId, project.template_type, `/workspace/project-${projectId}`);

        // 更新项目的 container_id
        db.prepare('UPDATE projects SET container_id = ? WHERE id = ?').run(containerId, projectId);
      }

      // 启动容器
      await startContainer(containerId);

      // 获取容器状态
      const status = await getContainerStatus(containerId);

      // 更新项目状态
      db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('running', projectId);

      res.json({ container_id: containerId, status });
    } catch (error) {
      logger.error('启动容器失败', error);
      res.status(500).json({ error: '启动容器失败' });
    }
  });

  // POST /api/projects/:id/container/stop - 停止容器
  router.post('/:id/container/stop', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查用户是否是项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 获取项目信息
    const project = getProject(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    if (!project.container_id) {
      res.status(400).json({ error: '项目没有关联的容器' });
      return;
    }

    try {
      // 先检查容器状态，如果已经停止则跳过
      const currentStatus = await getContainerStatus(project.container_id);
      if (currentStatus === 'running') {
        await stopContainer(project.container_id);
      }

      // 获取容器状态
      const status = await getContainerStatus(project.container_id);

      // 更新项目状态
      db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('stopped', projectId);

      res.json({ container_id: project.container_id, status });
    } catch (error) {
      logger.error('停止容器失败', error);
      res.status(500).json({ error: '停止容器失败' });
    }
  });

  // GET /api/projects/:id/container - 获取容器状态
  router.get('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查用户是否是项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 获取项目信息
    const project = getProject(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    if (!project.container_id) {
      res.status(404).json({ error: '容器不存在' });
      return;
    }

    try {
      // 获取容器状态
      const status = await getContainerStatus(project.container_id);
      res.json({ container_id: project.container_id, status });
    } catch (error) {
      logger.error('获取容器状态失败', error);
      res.status(500).json({ error: '获取容器状态失败' });
    }
  });

  // DELETE /api/projects/:id/container - 删除容器和卷
  router.delete('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查用户是否是项目 owner
    if (!isProjectOwner(projectId, userId)) {
      res.status(403).json({ error: '只有项目 owner 可以删除容器' });
      return;
    }

    // 获取项目信息
    const project = getProject(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    try {
      // 删除容器
      if (project.container_id) {
        await removeContainer(project.container_id);
      }

      // 删除卷
      await removeProjectVolume(projectId);

      // 更新项目状态
      db.prepare('UPDATE projects SET container_id = NULL, status = ? WHERE id = ?').run('created', projectId);

      res.status(204).send();
    } catch (error) {
      logger.error('删除容器失败', error);
      res.status(500).json({ error: '删除容器失败' });
    }
  });

  return router;
}