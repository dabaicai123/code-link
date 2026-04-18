import { Router } from 'express';
import { OrganizationService } from '../services/organization.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { success, Errors } from '../utils/response.js';

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
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('名称')) {
        res.status(400).json(Errors.conflict(error.message));
      } else {
        logger.error('创建组织失败', error);
        res.status(500).json(Errors.internal('创建组织失败'));
      }
    }
  });

  // GET /api/organizations - 获取用户所属的组织列表
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const organizations = await orgService.findByUserId(userId);
      res.json(success(organizations));
    } catch (error: any) {
      logger.error('获取组织列表失败', error);
      res.status(500).json(Errors.internal('获取组织列表失败'));
    }
  });

  // GET /api/organizations/:id - 获取组织详情
  router.get('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const org = await orgService.findById(orgId, userId);
      res.json(success(org));
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('不存在')) {
        res.status(404).json(Errors.notFound('组织'));
      } else {
        logger.error('获取组织详情失败', error);
        res.status(500).json(Errors.internal('获取组织详情失败'));
      }
    }
  });

  // PUT /api/organizations/:id - 修改组织名称
  router.put('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const org = await orgService.updateName(orgId, userId, req.body);
      res.json(success(org));
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('名称')) {
        res.status(400).json(Errors.conflict(error.message));
      } else if (error.message.includes('不存在')) {
        res.status(404).json(Errors.notFound('组织'));
      } else {
        logger.error('修改组织名称失败', error);
        res.status(500).json(Errors.internal('修改组织名称失败'));
      }
    }
  });

  // DELETE /api/organizations/:id - 删除组织
  router.delete('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      await orgService.delete(orgId, userId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('项目')) {
        res.status(400).json(Errors.conflict(error.message));
      } else if (error.message.includes('不存在')) {
        res.status(404).json(Errors.notFound('组织'));
      } else {
        logger.error('删除组织失败', error);
        res.status(500).json(Errors.internal('删除组织失败'));
      }
    }
  });

  // PUT /api/organizations/:id/members/:userId - 修改成员角色
  router.put('/:id/members/:userId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const targetUserId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

    if (isNaN(orgId) || isNaN(targetUserId)) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    try {
      const member = await orgService.updateMemberRole(orgId, userId, {
        userId: targetUserId,
        role: req.body.role,
      });
      res.json(success(member));
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('角色')) {
        res.status(400).json(Errors.conflict(error.message));
      } else if (error.message.includes('最后一个')) {
        res.status(400).json(Errors.conflict(error.message));
      } else if (error.message.includes('不存在') || error.message.includes('不是')) {
        res.status(404).json(Errors.notFound('成员'));
      } else {
        logger.error('修改成员角色失败', error);
        res.status(500).json(Errors.internal('修改成员角色失败'));
      }
    }
  });

  // DELETE /api/organizations/:id/members/:userId - 移除成员
  router.delete('/:id/members/:userId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const targetUserId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

    if (isNaN(orgId) || isNaN(targetUserId)) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    try {
      await orgService.removeMember(orgId, userId, targetUserId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('自己') || error.message.includes('最后一个')) {
        res.status(400).json(Errors.conflict(error.message));
      } else if (error.message.includes('不存在') || error.message.includes('不是')) {
        res.status(404).json(Errors.notFound('成员'));
      } else {
        logger.error('移除成员失败', error);
        res.status(500).json(Errors.internal('移除成员失败'));
      }
    }
  });

  // POST /api/organizations/:id/invitations - 邀请成员
  router.post('/:id/invitations', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const invitation = await orgService.inviteMember(orgId, userId, req.body);
      res.status(201).json(success(invitation));
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('邮箱') || error.message.includes('角色')) {
        res.status(400).json(Errors.conflict(error.message));
      } else if (error.message.includes('已是') || error.message.includes('已有')) {
        res.status(400).json(Errors.conflict(error.message));
      } else {
        logger.error('邀请成员失败', error);
        res.status(500).json(Errors.internal('邀请成员失败'));
      }
    }
  });

  // GET /api/organizations/:id/invitations - 获取待处理邀请列表
  router.get('/:id/invitations', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    try {
      const invitations = await orgService.findPendingInvitations(orgId, userId);
      res.json(success(invitations));
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else {
        logger.error('获取邀请列表失败', error);
        res.status(500).json(Errors.internal('获取邀请列表失败'));
      }
    }
  });

  // DELETE /api/organizations/:id/invitations/:invId - 取消邀请
  router.delete('/:id/invitations/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const invId = parseInt(Array.isArray(req.params.invId) ? req.params.invId[0] : req.params.invId, 10);

    if (isNaN(orgId) || isNaN(invId)) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    try {
      await orgService.cancelInvitation(orgId, userId, invId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else {
        logger.error('取消邀请失败', error);
        res.status(500).json(Errors.internal('取消邀请失败'));
      }
    }
  });

  return router;
}