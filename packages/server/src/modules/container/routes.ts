import { Router } from 'express';
import { validateParams } from '../../middleware/validation.js';
import { containerIdParamsSchema } from './schemas.js';
import { ContainerController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createContainerRoutes(controller: ContainerController): Router {
  const router = Router();

  router.post(
    '/:id/container/start',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.start(req, res))
  );

  router.post(
    '/:id/container/stop',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.stop(req, res))
  );

  router.get(
    '/:id/container',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.getStatus(req, res))
  );

  router.delete(
    '/:id/container',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.remove(req, res))
  );

  return router;
}
