import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { createProjectSchema, projectIdParamsSchema, addRepoSchema, repoIdParamsSchema } from './schemas.js';
import { ProjectController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createProjectRoutes(controller: ProjectController): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    validateBody(createProjectSchema),
    asyncHandler((req, res) => controller.create(req, res))
  );

  router.get(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.list(req, res))
  );

  router.get(
    '/:id',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.get(req, res))
  );

  router.delete(
    '/:id',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.delete(req, res))
  );

  // 仓库管理 API
  router.get(
    '/:id/repos',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.listRepos(req, res))
  );

  router.post(
    '/:id/repos',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(addRepoSchema),
    asyncHandler((req, res) => controller.addRepo(req, res))
  );

  router.delete(
    '/:id/repos/:repoId',
    authMiddleware,
    validateParams(repoIdParamsSchema),
    asyncHandler((req, res) => controller.deleteRepo(req, res))
  );

  return router;
}