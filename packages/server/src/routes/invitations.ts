import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import type { Organization, OrganizationInvitation } from '../types.js';

const logger = createLogger('invitations');

export function createInvitationsRouter(db: Database.Database): Router {
  const router = Router();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // GET /api/invitations - 获取用户收到的邀请
  router.get('/', (req, res) => {
    const userId = (req as any).userId;

    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const invitations = db
        .prepare(
          `SELECT oi.*, o.name as organization_name, u.name as invited_by_name
           FROM organization_invitations oi
           JOIN organizations o ON oi.organization_id = o.id
           LEFT JOIN users u ON oi.invited_by = u.id
           WHERE oi.email = ? AND oi.status = 'pending'
           ORDER BY oi.created_at DESC`
        )
        .all(user.email.toLowerCase());

      res.json(invitations);
    } catch (error) {
      logger.error('获取邀请列表失败', error);
      res.status(500).json({ error: '获取邀请列表失败' });
    }
  });

  // POST /api/invitations/:invId - 接受邀请
  router.post('/:invId', (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(req.params.invId, 10);

    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const invitation = db
        .prepare('SELECT * FROM organization_invitations WHERE id = ? AND email = ? AND status = ?')
        .get(invId, user.email.toLowerCase(), 'pending') as OrganizationInvitation | undefined;

      if (!invitation) {
        res.status(404).json({ error: '邀请不存在或已处理' });
        return;
      }

      const acceptTx = db.transaction(() => {
        // 更新邀请状态
        db.prepare("UPDATE organization_invitations SET status = 'accepted' WHERE id = ?").run(invId);

        // 添加为组织成员
        db.prepare(
          'INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
        ).run(invitation.organization_id, userId, invitation.role, invitation.invited_by);
      });

      acceptTx();

      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(invitation.organization_id) as Organization;

      const member = db
        .prepare(
          `SELECT om.*, u.name, u.email, u.avatar
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ? AND om.user_id = ?`
        )
        .get(invitation.organization_id, userId);

      res.json({ organization: org, member });
    } catch (error) {
      logger.error('接受邀请失败', error);
      res.status(500).json({ error: '接受邀请失败' });
    }
  });

  // DELETE /api/invitations/:invId - 拒绝邀请
  router.delete('/:invId', (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(req.params.invId, 10);

    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const result = db
        .prepare('UPDATE organization_invitations SET status = ? WHERE id = ? AND email = ? AND status = ?')
        .run('declined', invId, user.email.toLowerCase(), 'pending');

      if (result.changes === 0) {
        res.status(404).json({ error: '邀请不存在或已处理' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('拒绝邀请失败', error);
      res.status(500).json({ error: '拒绝邀请失败' });
    }
  });

  return router;
}
