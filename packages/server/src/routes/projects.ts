import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import type { Project, ProjectMember, User } from '../types.js';

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
    const { name, template_type } = req.body;

    if (!name || !template_type) {
      res.status(400).json({ error: '缺少必填字段：name, template_type' });
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
      // 使用事务确保原子性
      const createProjectTx = db.transaction(() => {
        const result = db
          .prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)')
          .run(name, template_type, userId);

        const projectId = result.lastInsertRowid;

        db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
          projectId,
          userId,
          'owner'
        );

        return projectId;
      });

      const projectId = createProjectTx();

      // 返回创建的项目
      const project = db
        .prepare('SELECT id, name, template_type, container_id, status, created_by, created_at FROM projects WHERE id = ?')
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
        `SELECT DISTINCT p.id, p.name, p.template_type, p.container_id, p.status, p.created_by, p.created_at
         FROM projects p
         JOIN project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(userId) as Project[];

    res.json(projects);
  });

  // GET /api/projects/:id - 获取项目详情
  router.get('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查用户是否是项目成员
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 获取项目信息
    const project = db
      .prepare('SELECT id, name, template_type, container_id, status, created_by, created_at FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;

    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 获取项目成员列表
    const members = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.avatar, pm.role
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = ?`
      )
      .all(projectId) as Array<{
      id: number;
      name: string;
      email: string;
      avatar: string | null;
      role: 'owner' | 'developer' | 'product';
    }>;

    // 获取项目关联的仓库列表
    const repos = db
      .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE project_id = ?')
      .all(projectId) as Array<{
        id: number;
        provider: 'github' | 'gitlab';
        repo_url: string;
        repo_name: string;
        branch: string;
        created_at: string;
      }>;

    res.json({ ...project, members, repos });
  });

  // DELETE /api/projects/:id - 删除项目（仅 owner 可删除）
  router.delete('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查用户是否是项目的 owner
    const membership = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId) as { role: string } | undefined;

    if (!membership || membership.role !== 'owner') {
      res.status(403).json({ error: '只有项目 owner 可以删除项目' });
      return;
    }

    // 删除项目（会级联删除 project_members）
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

    if (result.changes === 0) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    res.status(204).send();
  });

  return router;
}