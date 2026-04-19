import { Router } from 'express';
import { OrganizationService } from '../services/organization.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { success, Errors, handleRouteError } from '../utils/response.js';
import { parseIdParam } from '../utils/params.js';

const logger = createLogger('organizations');

export function createOrganizationsRouter(): Router {
  const router = Router();
  const orgService = new OrganizationService();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // POST /api/organizations - 创建组织
  router.post('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const org = await orgService.create(userId, req.body);
      res.status(201).json(success(org));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '创建组织失败');
    }
  });

  // GET /api/organizations - 获取用户所属的组织列表
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const organizations = await orgService.findByUserId(userId);
      res.json(success(organizations));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取组织列表失败');
    }
  });

  // GET /api/organizations/:id - 获取组织详情
  router.get('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);

    if (orgId === null) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const org = await orgService.findById(orgId, userId);
      res.json(success(org));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取组织详情失败');
    }
  });

  // PUT /api/organizations/:id - 修改组织名称
  router.put('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);

    if (orgId === null) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const org = await orgService.updateName(orgId, userId, req.body);
      res.json(success(org));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '修改组织名称失败');
    }
  });

  // DELETE /api/organizations/:id - 删除组织
  router.delete('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);

    if (orgId === null) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      await orgService.delete(orgId, userId);
      res.status(204).send();
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '删除组织失败');
    }
  });

  // PUT /api/organizations/:id/members/:userId - 修改成员角色
  router.put('/:id/members/:userId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);
    const targetUserId = parseIdParam(req.params.userId);

    if (orgId === null || targetUserId === null) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    try {
      const member = await orgService.updateMemberRole(orgId, userId, {
        userId: targetUserId,
        role: req.body.role,
      });
      res.json(success(member));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '修改成员角色失败');
    }
  });

  // DELETE /api/organizations/:id/members/:userId - 移除成员
  router.delete('/:id/members/:userId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);
    const targetUserId = parseIdParam(req.params.userId);

    if (orgId === null || targetUserId === null) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    try {
      await orgService.removeMember(orgId, userId, targetUserId);
      res.status(204).send();
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '移除成员失败');
    }
  });

  // POST /api/organizations/:id/invitations - 邀请成员
  router.post('/:id/invitations', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);

    if (orgId === null) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const invitation = await orgService.inviteMember(orgId, userId, req.body);
      res.status(201).json(success(invitation));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '邀请成员失败');
    }
  });

  // GET /api/organizations/:id/invitations - 获取待处理邀请列表
  router.get('/:id/invitations', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);

    if (orgId === null) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const invitations = await orgService.findPendingInvitations(orgId, userId);
      res.json(success(invitations));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取邀请列表失败');
    }
  });

  // DELETE /api/organizations/:id/invitations/:invId - 取消邀请
  router.delete('/:id/invitations/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.id);
    const invId = parseIdParam(req.params.invId);

    if (orgId === null || invId === null) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    try {
      await orgService.cancelInvitation(orgId, userId, invId);
      res.status(204).send();
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '取消邀请失败');
    }
  });

  return router;
}