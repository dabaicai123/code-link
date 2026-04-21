import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { createOrganizationSchema, updateOrganizationSchema, orgIdParamsSchema, inviteMemberSchema, invitationIdParamsSchema } from './schemas.js';
import { OrganizationController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createOrganizationRoutes(controller: OrganizationController): Router {
  const router = Router();

  // Organization CRUD
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

  // Organization invitations
  router.post(
    '/:id/invitations',
    authMiddleware,
    validateParams(orgIdParamsSchema),
    validateBody(inviteMemberSchema),
    asyncHandler((req, res) => controller.inviteMember(req, res))
  );

  router.get(
    '/:id/invitations',
    authMiddleware,
    validateParams(orgIdParamsSchema),
    asyncHandler((req, res) => controller.getInvitations(req, res))
  );

  router.delete(
    '/:id/invitations/:invId',
    authMiddleware,
    validateParams(invitationIdParamsSchema),
    asyncHandler((req, res) => controller.cancelInvitation(req, res))
  );

  return router;
}

export function createInvitationRoutes(controller: OrganizationController): Router {
  const router = Router();

  // User's own invitations
  router.get(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.getMyInvitations(req, res))
  );

  router.post(
    '/:invId',
    authMiddleware,
    validateParams(invitationIdParamsSchema),
    asyncHandler((req, res) => controller.acceptInvitation(req, res))
  );

  router.delete(
    '/:invId',
    authMiddleware,
    validateParams(invitationIdParamsSchema),
    asyncHandler((req, res) => controller.declineInvitation(req, res))
  );

  return router;
}
