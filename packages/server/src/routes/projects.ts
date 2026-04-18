import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('projects');

export function createProjectsRouter(): Router {
  const router = Router();
  const projectService = new ProjectService();

  // POST /api/projects - 创建项目
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const project = await projectService.create(userId, req.body);
      res.status(201).json(project);
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('名称') || error.message.includes('模板')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('创建项目失败', error);
        res.status(500).json({ error: '创建项目失败' });
      }
    }
  });

  // GET /api/projects - 获取用户参与的所有项目
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const projects = await projectService.findByUserId(userId);
      res.json(projects);
    } catch (error: any) {
      logger.error('获取项目列表失败', error);
      res.status(500).json({ error: '获取项目列表失败' });
    }
  });

  // GET /api/projects/:id - 获取项目详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const project = await projectService.findById(userId, projectId);
      res.json(project);
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取项目详情失败', error);
        res.status(500).json({ error: '获取项目详情失败' });
      }
    }
  });

  // DELETE /api/projects/:id - 删除项目
  router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      await projectService.delete(userId, projectId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('删除项目失败', error);
        res.status(500).json({ error: '删除项目失败' });
      }
    }
  });

  return router;
}