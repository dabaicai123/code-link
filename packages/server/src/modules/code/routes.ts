import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateParams, validateQuery, validateBody } from '../../middleware/validation.js';
import {
  projectIdParamsSchema, filePathQuerySchema, commitHashQuerySchema,
  commitBodySchema, stageBodySchema, discardBodySchema, pushBodySchema, pullBodySchema,
} from './schemas.js';
import { CodeController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';

export function createCodeRoutes(controller: CodeController): Router {
  const router = Router();

  // File operations
  router.get(
    '/:projectId/code/tree',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getFileTree(req, res)),
  );
  router.get(
    '/:projectId/code/file',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateQuery(filePathQuerySchema),
    asyncHandler((req, res) => controller.getFileContent(req, res)),
  );

  // Git read operations
  router.get(
    '/:projectId/code/git/status',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getGitStatus(req, res)),
  );
  router.get(
    '/:projectId/code/git/log',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getGitLog(req, res)),
  );
  router.get(
    '/:projectId/code/git/branches',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getBranches(req, res)),
  );
  router.get(
    '/:projectId/code/git/diff',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateQuery(commitHashQuerySchema),
    asyncHandler((req, res) => controller.getCommitDiff(req, res)),
  );

  // Git write operations
  router.post(
    '/:projectId/code/git/commit',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(commitBodySchema),
    asyncHandler((req, res) => controller.commit(req, res)),
  );
  router.post(
    '/:projectId/code/git/push',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(pushBodySchema),
    asyncHandler((req, res) => controller.push(req, res)),
  );
  router.post(
    '/:projectId/code/git/pull',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(pullBodySchema),
    asyncHandler((req, res) => controller.pull(req, res)),
  );
  router.post(
    '/:projectId/code/git/stage',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(stageBodySchema),
    asyncHandler((req, res) => controller.stage(req, res)),
  );
  router.post(
    '/:projectId/code/git/discard',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(discardBodySchema),
    asyncHandler((req, res) => controller.discard(req, res)),
  );

  return router;
}