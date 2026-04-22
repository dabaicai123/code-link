import { Router } from 'express';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middleware/auth.js';
import { validateParams } from '../../middleware/validation.js';
import { projectIdParamsSchema } from './schemas.js';
import { CodeController } from './controller.js';
import { CodeServerManager } from './lib/code-server-manager.js';
import { createCodeServerProxy } from './proxy.js';
import { asyncHandler } from '../../core/errors/index.js';

export function createCodeRoutes(controller: CodeController): Router {
  const router = Router();

  // Code-server lifecycle
  router.post(
    '/:projectId/code-server/start',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.startCodeServer(req, res)),
  );
  router.post(
    '/:projectId/code-server/stop',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.stopCodeServer(req, res)),
  );
  router.get(
    '/:projectId/code-server/status',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getCodeServerStatus(req, res)),
  );

  // Reverse proxy to code-server inside container (all HTTP)
  router.use(
    '/:projectId/code-server',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    createCodeServerProxy(container.resolve(CodeServerManager)),
  );

  return router;
}