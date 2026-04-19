import { Router } from 'express';
import { ClaudeConfigController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createClaudeConfigRoutes(controller: ClaudeConfigController): Router {
  const router = Router();

  router.get(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.get(req, res))
  );

  router.post(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.save(req, res))
  );

  router.delete(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.delete(req, res))
  );

  return router;
}
