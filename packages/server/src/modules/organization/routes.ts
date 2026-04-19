import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { createOrganizationSchema, updateOrganizationSchema, orgIdParamsSchema } from './schemas.js';
import { OrganizationController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createOrganizationRoutes(controller: OrganizationController): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    validateBody(createOrganizationSchema),
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
    validateParams(orgIdParamsSchema),
    asyncHandler((req, res) => controller.get(req, res))
  );

  router.put(
    '/:id',
    authMiddleware,
    validateParams(orgIdParamsSchema),
    validateBody(updateOrganizationSchema),
    asyncHandler((req, res) => controller.update(req, res))
  );

  router.delete(
    '/:id',
    authMiddleware,
    validateParams(orgIdParamsSchema),
    asyncHandler((req, res) => controller.delete(req, res))
  );

  return router;
}
