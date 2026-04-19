import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { createBuildSchema, projectIdParamsSchema, buildIdParamsSchema } from './schemas.js';
import { BuildController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createBuildRoutes(controller: BuildController): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    validateBody(createBuildSchema),
    asyncHandler((req, res) => controller.create(req, res))
  );

  router.get(
    '/project/:projectId',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.listByProject(req, res))
  );

  router.get(
    '/:id',
    authMiddleware,
    validateParams(buildIdParamsSchema),
    asyncHandler((req, res) => controller.get(req, res))
  );

  router.get(
    '/preview/:projectId',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getPreview(req, res))
  );

  router.delete(
    '/preview/:projectId',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.stopPreview(req, res))
  );

  return router;
}
