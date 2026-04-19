// packages/server/src/routes/builds.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { getBuildManager } from '../build/build-manager.js';
import { getPreviewContainerManager } from '../build/preview-container.js';
import { ProjectRepository, OrganizationRepository } from '../repositories/index.js';
import { success, Errors } from '../utils/response.js';

const logger = createLogger('builds');

export function createBuildsRouter(): Router {
  const router = Router();
  const projectRepo = container.resolve(ProjectRepository);
  const orgRepo = container.resolve(OrganizationRepository);

  // POST /api/builds - 创建构建
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json(Errors.paramMissing('projectId'));
      return;
    }

    // 检查权限
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    try {
      const buildManager = getBuildManager();
      const build = await buildManager.createBuild(projectId);

      // 异步启动构建（不等待）
      buildManager.startBuild(projectId, build.id).catch((error) => {
        logger.error('Build failed', error);
      });

      res.status(201).json(success(build));
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  // GET /api/builds/project/:projectId - 获取项目的构建列表
  router.get('/project/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.projectId;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    // 检查权限
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const buildManager = getBuildManager();
    const builds = await buildManager.getProjectBuilds(projectId);

    res.json(success(builds));
  });

  // GET /api/builds/:id - 获取构建详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const buildId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(buildId)) {
      res.status(400).json(Errors.paramInvalid('构建 ID'));
      return;
    }

    const buildManager = getBuildManager();
    const build = await buildManager.getBuild(buildId);

    if (!build) {
      res.status(404).json(Errors.notFound('构建'));
      return;
    }

    // 检查权限
    const project = await projectRepo.findById(build.projectId);
    if (!project) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    res.json(success(build));
  });

  // GET /api/builds/preview/:projectId - 获取项目预览 URL
  router.get('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.projectId;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    // 检查权限
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const previewManager = getPreviewContainerManager();
    const containerInfo = previewManager.getContainerInfo(projectId.toString());

    if (!containerInfo) {
      res.status(404).json(Errors.notFound('预览容器'));
      return;
    }

    res.json(success({
      url: previewManager.getPreviewUrl(containerInfo.port),
      port: containerInfo.port,
    }));
  });

  // DELETE /api/builds/preview/:projectId - 停止预览容器
  router.delete('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.projectId;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    // 检查权限
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    const previewManager = getPreviewContainerManager();
    await previewManager.stopPreviewContainer(projectId.toString());

    res.status(204).send();
  });

  return router;
}