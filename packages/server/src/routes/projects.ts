import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import type { Project, OrgRole } from '../types.js';

const logger = createLogger('projects');

const VALID_TEMPLATE_TYPES = ['node', 'node+java', 'node+python'] as const;
type TemplateType = (typeof VALID_TEMPLATE_TYPES)[number];

function isValidTemplateType(type: string): type is TemplateType {
  return VALID_TEMPLATE_TYPES.includes(type as TemplateType);
}

export function createProjectsRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/projects - 创建项目
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const { name, template_type, organization_id } = req.body;

    if (!name || !template_type || !organization_id) {
      res.status(400).json({ error: '缺少必填字段：name, template_type, organization_id' });
      return;
    }

    if (typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ error: '项目名称必须是 1-100 字符的字符串' });
      return;
    }

    if (!isValidTemplateType(template_type)) {
      res.status(400).json({ error: '无效的模板类型，必须是 node, node+java 或 node+python' });
      return;
    }

    try {
      // 检查用户是否有权限在该组织下创建项目（developer 或 owner）
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare(
            "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND role IN ('owner', 'developer')"
          )
          .get(organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '您没有权限在该组织下创建项目' });
          return;
        }
      }

      const result = db
        .prepare('INSERT INTO projects (name, template_type, organization_id, created_by) VALUES (?, ?, ?, ?)')
        .run(name, template_type, organization_id, userId);

      const projectId = result.lastInsertRowid;

      const project = db
        .prepare('SELECT id, name, template_type, organization_id, container_id, status, created_by, created_at FROM projects WHERE id = ?')
        .get(projectId) as Project;

      res.status(201).json(project);
    } catch (error) {
      logger.error('创建项目失败', error);
      res.status(500).json({ error: '创建项目失败' });
    }
  });

  // GET /api/projects - 获取用户参与的所有项目
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    const projects = db
      .prepare(
        `SELECT DISTINCT p.id, p.name, p.template_type, p.organization_id, p.container_id, p.status, p.created_by, p.created_at
         FROM projects p
         JOIN organization_members om ON p.organization_id = om.organization_id
         WHERE om.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(userId) as Project[];

    res.json(projects);
  });

  // GET /api/projects/:id - 获取项目详情
  router.get('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      // 获取项目信息
      const project = db
        .prepare('SELECT id, name, template_type, organization_id, container_id, status, created_by, created_at FROM projects WHERE id = ?')
        .get(projectId) as Project | undefined;

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查用户是否是组织成员
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare('SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?')
          .get(project.organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '您没有权限访问该项目' });
          return;
        }
      }

      // 获取组织成员作为项目成员列表
      const members = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.avatar, om.role
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ?`
        )
        .all(project.organization_id) as Array<{
        id: number;
        name: string;
        email: string;
        avatar: string | null;
        role: OrgRole;
      }>;

      // 获取项目关联的仓库列表
      const repos = db
        .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE project_id = ?')
        .all(projectId);

      res.json({ ...project, members, repos });
    } catch (error) {
      logger.error('获取项目详情失败', error);
      res.status(500).json({ error: '获取项目详情失败' });
    }
  });

  // DELETE /api/projects/:id - 删除项目（仅 owner 可删除）
  router.delete('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      // 获取项目信息
      const project = db
        .prepare('SELECT organization_id FROM projects WHERE id = ?')
        .get(projectId) as { organization_id: number } | undefined;

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查用户是否是组织的 owner
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND role = 'owner'")
          .get(project.organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '只有组织 owner 可以删除项目' });
          return;
        }
      }

      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      if (result.changes === 0) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('删除项目失败', error);
      res.status(500).json({ error: '删除项目失败' });
    }
  });

  return router;
}