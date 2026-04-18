import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware, createOrgMemberMiddleware, createCanCreateOrgMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import type { Organization, OrgRole, OrganizationInvitation } from '../types.js';

const logger = createLogger('organizations');

export function createOrganizationsRouter(db: Database.Database): Router {
  const router = Router();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // POST /api/organizations - 创建组织
  router.post('/', createCanCreateOrgMiddleware(db), (req, res) => {
    const userId = (req as any).userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: '组织名称不能为空' });
      return;
    }

    if (name.length > 100) {
      res.status(400).json({ error: '组织名称不能超过 100 个字符' });
      return;
    }

    try {
      const createOrgTx = db.transaction(() => {
        const result = db
          .prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)')
          .run(name.trim(), userId);

        const orgId = result.lastInsertRowid as number;

        // 创建者自动成为 owner
        db.prepare(
          'INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
        ).run(orgId, userId, 'owner', userId);

        return orgId;
      });

      const orgId = createOrgTx();

      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(orgId) as Organization;

      res.status(201).json(org);
    } catch (error) {
      logger.error('创建组织失败', error);
      res.status(500).json({ error: '创建组织失败' });
    }
  });

  // GET /api/organizations - 获取用户所属的组织列表
  router.get('/', (req, res) => {
    const userId = (req as any).userId;

    try {
      const organizations = db
        .prepare(
          `SELECT o.id, o.name, o.created_by, o.created_at, om.role
           FROM organizations o
           JOIN organization_members om ON o.id = om.organization_id
           WHERE om.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .all(userId) as Array<Organization & { role: OrgRole }>;

      res.json(organizations);
    } catch (error) {
      logger.error('获取组织列表失败', error);
      res.status(500).json({ error: '获取组织列表失败' });
    }
  });

  // GET /api/organizations/:id - 获取组织详情
  router.get('/:id', createOrgMemberMiddleware(db, 'member'), (req, res) => {
    const idParam = req.params.id;
    const orgId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    try {
      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(orgId) as Organization | undefined;

      if (!org) {
        res.status(404).json({ error: '组织不存在' });
        return;
      }

      // 获取组织成员列表
      const members = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.avatar, om.role, om.joined_at
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ?
           ORDER BY om.joined_at ASC`
        )
        .all(orgId) as Array<{
          id: number;
          name: string;
          email: string;
          avatar: string | null;
          role: OrgRole;
          joined_at: string;
        }>;

      res.json({ ...org, members });
    } catch (error) {
      logger.error('获取组织详情失败', error);
      res.status(500).json({ error: '获取组织详情失败' });
    }
  });

  // PUT /api/organizations/:id - 修改组织名称
  router.put('/:id', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const idParam = req.params.id;
    const orgId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: '组织名称不能为空' });
      return;
    }

    if (name.length > 100) {
      res.status(400).json({ error: '组织名称不能超过 100 个字符' });
      return;
    }

    try {
      const result = db
        .prepare('UPDATE organizations SET name = ? WHERE id = ?')
        .run(name.trim(), orgId);

      if (result.changes === 0) {
        res.status(404).json({ error: '组织不存在' });
        return;
      }

      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(orgId) as Organization;

      res.json(org);
    } catch (error) {
      logger.error('修改组织名称失败', error);
      res.status(500).json({ error: '修改组织名称失败' });
    }
  });

  // DELETE /api/organizations/:id - 删除组织
  router.delete('/:id', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const idParam = req.params.id;
    const orgId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    try {
      // 检查组织下是否还有项目
      const projectCount = db
        .prepare('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?')
        .get(orgId) as { count: number };

      if (projectCount.count > 0) {
        res.status(400).json({ error: '组织下还有项目，请先删除或迁移项目' });
        return;
      }

      const result = db.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);

      if (result.changes === 0) {
        res.status(404).json({ error: '组织不存在' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('删除组织失败', error);
      res.status(500).json({ error: '删除组织失败' });
    }
  });

  // GET /api/invitations - 获取用户收到的邀请
  router.get('/invitations', (req, res) => {
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
  router.post('/invitations/:invId', (req, res) => {
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
  router.delete('/invitations/:invId', (req, res) => {
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

  // POST /api/organizations/:id/invitations - 邀请成员
  router.post('/:id/invitations', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const idParam = req.params.id;
    const orgId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
    const userId = (req as any).userId;
    const { email, role } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: '邮箱地址不能为空' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: '邮箱地址格式不正确' });
      return;
    }

    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: '无效的角色，必须是 owner、developer 或 member' });
      return;
    }

    try {
      // 检查用户是否已是组织成员
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
      if (existingUser) {
        const existingMember = db
          .prepare('SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?')
          .get(orgId, existingUser.id);
        if (existingMember) {
          res.status(400).json({ error: '该用户已是组织成员' });
          return;
        }
      }

      // 检查是否已有待处理邀请
      const existingInvitation = db
        .prepare("SELECT id FROM organization_invitations WHERE organization_id = ? AND email = ? AND status = 'pending'")
        .get(orgId, email);
      if (existingInvitation) {
        res.status(400).json({ error: '该邮箱已有待处理的邀请' });
        return;
      }

      const result = db
        .prepare(
          'INSERT INTO organization_invitations (organization_id, email, role, invited_by) VALUES (?, ?, ?, ?)'
        )
        .run(orgId, email.toLowerCase(), role, userId);

      const invitation = db
        .prepare('SELECT * FROM organization_invitations WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(invitation);
    } catch (error) {
      logger.error('邀请成员失败', error);
      res.status(500).json({ error: '邀请成员失败' });
    }
  });

  // GET /api/organizations/:id/invitations - 获取待处理邀请列表
  router.get('/:id/invitations', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const idParam = req.params.id;
    const orgId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    try {
      const invitations = db
        .prepare(
          `SELECT oi.*, u.name as invited_by_name
           FROM organization_invitations oi
           LEFT JOIN users u ON oi.invited_by = u.id
           WHERE oi.organization_id = ? AND oi.status = 'pending'
           ORDER BY oi.created_at DESC`
        )
        .all(orgId);

      res.json(invitations);
    } catch (error) {
      logger.error('获取邀请列表失败', error);
      res.status(500).json({ error: '获取邀请列表失败' });
    }
  });

  // DELETE /api/organizations/:id/invitations/:invId - 取消邀请
  router.delete('/:id/invitations/:invId', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const idParam = req.params.id;
    const invIdParam = req.params.invId;
    const orgId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
    const invId = parseInt(Array.isArray(invIdParam) ? invIdParam[0] : invIdParam, 10);

    try {
      const result = db
        .prepare('DELETE FROM organization_invitations WHERE id = ? AND organization_id = ? AND status = ?')
        .run(invId, orgId, 'pending');

      if (result.changes === 0) {
        res.status(404).json({ error: '邀请不存在或已处理' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('取消邀请失败', error);
      res.status(500).json({ error: '取消邀请失败' });
    }
  });

  return router;
}
