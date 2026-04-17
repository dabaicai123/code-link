import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.ts';
import type { Project, ProjectMember, User } from '../types.ts';

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

    if (!isValidTemplateType(template_type)) {
      res.status(400).json({ error: '无效的模板类型，必须是 node, node+java 或 node+python' });
      return;
    }

    // 创建项目
    const result = db
      .prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)')
      .run(name, template_type, userId);

    const projectId = result.lastInsertRowid;

    // 添加创建者为 owner
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
      projectId,
      userId,
      'owner'
    );

    // 返回创建的项目
    const project = db
      .prepare('SELECT id, name, template_type, container_id, status, github_repo, created_by, created_at FROM projects WHERE id = ?')
      .get(projectId) as Project;

    res.status(201).json(project);
  });

  // GET /api/projects - 获取用户参与的所有项目
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    const projects = db
      .prepare(
        `SELECT DISTINCT p.id, p.name, p.template_type, p.container_id, p.status, p.github_repo, p.created_by, p.created_at
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
    const projectId = parseInt(req.params.id, 10);

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
      .prepare('SELECT id, name, template_type, container_id, status, github_repo, created_by, created_at FROM projects WHERE id = ?')
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

    res.json({ ...project, members });
  });

  // DELETE /api/projects/:id - 删除项目（仅 owner 可删除）
  router.delete('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

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