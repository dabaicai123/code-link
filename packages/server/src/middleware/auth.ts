import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../logger/index.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { UserRepository, OrganizationRepository, ProjectRepository } from '../repositories/index.js';
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
 * @param minRole 最低需要的角色
 */
export function createOrgMemberMiddleware(minRole: OrgRole) {
  const userRepo = new UserRepository();
  const orgRepo = new OrganizationRepository();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const userEmail = await userRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      (req as any).orgRole = 'owner';
      next();
      return;
    }

    // 检查组织成员角色
    const membership = await orgRepo.findUserMembership(orgId, userId);

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
 * @param minRole 最低需要的角色
 */
export function createProjectMemberMiddleware(minRole: OrgRole) {
  const userRepo = new UserRepository();
  const orgRepo = new OrganizationRepository();
  const projectRepo = new ProjectRepository();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const userEmail = await userRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      next();
      return;
    }

    // 获取项目所属组织
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    if (!project.organizationId) {
      res.status(403).json({ error: '该项目未关联组织' });
      return;
    }

    // 检查组织成员角色
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);

    if (!membership) {
      res.status(403).json({ error: '您不是该项目的成员' });
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    next();
  };
}

/**
 * 检查用户是否有权创建组织
 * 超级管理员或现有组织的 owner 可以创建
 */
export function createCanCreateOrgMiddleware() {
  const userRepo = new UserRepository();
  const orgRepo = new OrganizationRepository();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const userEmail = await userRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      next();
      return;
    }

    // 检查用户是否是任何组织的 owner
    const isOwner = await orgRepo.isOwnerOfAny(userId);
    if (!isOwner) {
      res.status(403).json({ error: '只有组织 owner 或超级管理员可以创建组织' });
      return;
    }

    next();
  };
}