import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { success, Errors, handleRouteError } from '../utils/response.js';

const logger = createLogger('projects');

export function createProjectsRouter(): Router {
  const router = Router();
  const projectService = container.resolve(ProjectService);

  // POST /api/projects - 创建项目
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const project = await projectService.create(userId, req.body);
      res.status(201).json(success(project));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '创建项目失败');
    }
  });

  // GET /api/projects - 获取用户参与的所有项目
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string, 10) : undefined;

    try {
      const projects = await projectService.findByUserId(userId, organizationId);
      res.json(success(projects));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取项目列表失败');
    }
  });

  // GET /api/projects/:id - 获取项目详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    try {
      const project = await projectService.findById(userId, projectId);
      res.json(success(project));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取项目详情失败');
    }
  });

  // DELETE /api/projects/:id - 删除项目
  router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    try {
      await projectService.delete(userId, projectId);
      res.status(204).send();
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '删除项目失败');
    }
  });

  return router;
}