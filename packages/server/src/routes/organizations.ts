import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware, createOrgMemberMiddleware, createCanCreateOrgMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import type { Organization, OrgRole } from '../types.js';

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

  return router;
}
