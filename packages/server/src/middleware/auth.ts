import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createLogger } from '../logger/index.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import type { OrgRole } from '../types.js';

// 角色层级定义
const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      orgRole?: OrgRole;
      projectRole?: OrgRole;
    }
  }
}

const logger = createLogger('auth');

const DEFAULT_SECRET = 'code-link-dev-secret';

if (!process.env.JWT_SECRET) {
  logger.warn('Using default JWT_SECRET. Set JWT_SECRET in production!');
}

export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.debug('No auth token provided');
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = header.slice(7);
  if (!token) {
    logger.debug('Empty auth token');
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
      logger.warn('Invalid token payload structure');
      res.status(401).json({ error: '无效的认证令牌' });
      return;
    }
    logger.debug(`Token verified for userId=${payload.userId}`);
    (req as any).userId = payload.userId;
    next();
  } catch (err) {
    logger.warn('Token verification failed', err);
    res.status(401).json({ error: '无效的认证令牌' });
  }
}

/**
 * 创建组织权限检查中间件
 * @param db 数据库实例
 * @param minRole 最低需要的角色
 */
export function createOrgMemberMiddleware(db: Database.Database, minRole: OrgRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId;
    const orgIdParam = req.params.orgId || req.params.id || req.body.organization_id;
    const orgId = parseInt(Array.isArray(orgIdParam) ? orgIdParam[0] : orgIdParam || '', 10);

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;

    if (user && isSuperAdmin(user.email)) {
      (req as any).orgRole = 'owner';
      next();
      return;
    }

    // 检查组织成员角色
    const membership = db.prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    ).get(orgId, userId) as { role: OrgRole } | undefined;

    if (!membership) {
      res.status(403).json({ error: '您不是该组织的成员' });
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    (req as any).orgRole = membership.role;
    next();
  };
}

/**
 * 创建项目权限检查中间件
 * 通过项目关联的组织检查用户权限
 *
 * 前提条件：projects 表必须有 organization_id 字段
 * 此字段将在第二阶段迁移中添加
 *
 * @param db 数据库实例
 * @param minRole 最低需要的角色
 */
export function createProjectMemberMiddleware(db: Database.Database, minRole: OrgRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId;
    const projectIdParam = req.params.id || req.params.projectId;
    const projectId = parseInt(Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam || '', 10);

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;

    if (user && isSuperAdmin(user.email)) {
      (req as any).projectRole = 'owner';
      next();
      return;
    }

    // 获取项目所属组织
    const project = db.prepare('SELECT organization_id FROM projects WHERE id = ?').get(projectId) as { organization_id: number } | undefined;

    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查组织成员角色
    const membership = db.prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    ).get(project.organization_id, userId) as { role: OrgRole } | undefined;

    if (!membership) {
      res.status(403).json({ error: '您不是该项目的成员' });
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    (req as any).projectRole = membership.role;
    next();
  };
}

/**
 * 检查用户是否有权创建组织
 * 超级管理员或现有组织的 owner 可以创建
 */
export function createCanCreateOrgMiddleware(db: Database.Database) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;

    if (user && isSuperAdmin(user.email)) {
      next();
      return;
    }

    // 检查用户是否是任何组织的 owner
    const ownership = db.prepare(
      "SELECT 1 FROM organization_members WHERE user_id = ? AND role = 'owner' LIMIT 1"
    ).get(userId);

    if (!ownership) {
      res.status(403).json({ error: '只有组织 owner 或超级管理员可以创建组织' });
      return;
    }

    next();
  };
}