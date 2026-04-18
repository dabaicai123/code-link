import { Router } from 'express';
import { OrganizationService } from '../services/organization.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('invitations');

export function createInvitationsRouter(): Router {
  const router = Router();
  const orgService = new OrganizationService();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // GET /api/invitations - 获取用户收到的邀请
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const invitations = await orgService.findUserInvitations(userId);
      res.json(invitations);
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取邀请列表失败', error);
        res.status(500).json({ error: '获取邀请列表失败' });
      }
    }
  });

  // POST /api/invitations/:invId - 接受邀请
  router.post('/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(Array.isArray(req.params.invId) ? req.params.invId[0] : req.params.invId, 10);

    if (isNaN(invId)) {
      res.status(400).json({ error: '无效的邀请 ID' });
      return;
    }

    try {
      const result = await orgService.acceptInvitation(userId, invId);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('不存在') || error.message.includes('已处理')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('接受邀请失败', error);
        res.status(500).json({ error: '接受邀请失败' });
      }
    }
  });

  // DELETE /api/invitations/:invId - 拒绝邀请
  router.delete('/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(Array.isArray(req.params.invId) ? req.params.invId[0] : req.params.invId, 10);

    if (isNaN(invId)) {
      res.status(400).json({ error: '无效的邀请 ID' });
      return;
    }

    try {
      await orgService.declineInvitation(userId, invId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('不存在') || error.message.includes('已处理')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('拒绝邀请失败', error);
        res.status(500).json({ error: '拒绝邀请失败' });
      }
    }
  });

  return router;
}