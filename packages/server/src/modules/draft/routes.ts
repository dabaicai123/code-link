import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.js';
import {
  createDraftSchema,
  updateDraftStatusSchema,
  createDraftMessageSchema,
  confirmMessageSchema,
  addDraftMemberSchema,
  draftIdParamsSchema,
  messageIdParamsSchema,
  memberIdParamsSchema,
  paginationQuerySchema,
} from './schemas.js';
import { DraftController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createDraftRoutes(controller: DraftController): Router {
  const router = Router();

  // ==================== Draft CRUD ====================

  router.post(
    '/',
    authMiddleware,
    validateBody(createDraftSchema),
    asyncHandler((req, res) => controller.create(req, res))
  );

  router.get(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.list(req, res))
  );

  router.get(
    '/:draftId',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    asyncHandler((req, res) => controller.get(req, res))
  );

  router.put(
    '/:draftId/status',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    validateBody(updateDraftStatusSchema),
    asyncHandler((req, res) => controller.updateStatus(req, res))
  );

  router.delete(
    '/:draftId',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    asyncHandler((req, res) => controller.delete(req, res))
  );

  // ==================== Card Management ====================

  router.get(
    '/:draftId/cards',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    asyncHandler((req, res) => controller.listCards(req, res))
  );

  // ==================== Message Management ====================

  router.post(
    '/:draftId/messages',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    validateBody(createDraftMessageSchema),
    asyncHandler((req, res) => controller.createMessage(req, res))
  );

  router.get(
    '/:draftId/messages',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    validateQuery(paginationQuerySchema),
    asyncHandler((req, res) => controller.listMessages(req, res))
  );

  // ==================== Confirmation Management ====================

  router.post(
    '/:draftId/messages/:messageId/confirm',
    authMiddleware,
    validateParams(messageIdParamsSchema),
    validateBody(confirmMessageSchema),
    asyncHandler((req, res) => controller.confirmMessage(req, res))
  );

  router.get(
    '/:draftId/messages/:messageId/confirmations',
    authMiddleware,
    validateParams(messageIdParamsSchema),
    asyncHandler((req, res) => controller.listConfirmations(req, res))
  );

  // ==================== Member Management ====================

  router.post(
    '/:draftId/members',
    authMiddleware,
    validateParams(draftIdParamsSchema),
    validateBody(addDraftMemberSchema),
    asyncHandler((req, res) => controller.addMember(req, res))
  );

  router.delete(
    '/:draftId/members/:memberId',
    authMiddleware,
    validateParams(memberIdParamsSchema),
    asyncHandler((req, res) => controller.removeMember(req, res))
  );

  return router;
}