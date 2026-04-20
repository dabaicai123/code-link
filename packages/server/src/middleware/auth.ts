import "reflect-metadata";
import { container } from "tsyringe";
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger/index.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { ROLE_HIERARCHY } from '../utils/roles.js';
import { AuthRepository } from '../modules/auth/repository.js';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { Errors } from '../core/errors/index.js';
import { getConfig } from '../core/config.js';
import type { OrgRole } from '../db/schema/index.js';

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

// 单例 Repository 实例通过容器获取
const authRepo = container.resolve(AuthRepository);
const orgRepo = container.resolve(OrganizationRepository);
const projectRepo = container.resolve(ProjectRepository);

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.debug('No auth token provided');
    res.status(401).json(Errors.unauthorized());
    return;
  }

  const token = header.slice(7);
  if (!token) {
    logger.debug('Empty auth token');
    res.status(401).json(Errors.unauthorized());
    return;
  }

  try {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
      logger.warn('Invalid token payload structure');
      res.status(401).json(Errors.unauthorized());
      return;
    }
    logger.debug(`Token verified for userId=${payload.userId}`);
    req.userId = payload.userId;
    next();
  } catch (err) {
    logger.warn('Token verification failed', err);
    res.status(401).json(Errors.unauthorized());
  }
}

/**
 * 创建组织权限检查中间件
 * @param minRole 最低需要的角色
 */
export function createOrgMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const orgIdParam = req.params.orgId || req.params.id || req.body.organization_id;
    const orgId = parseInt(Array.isArray(orgIdParam) ? orgIdParam[0] : orgIdParam || '', 10);

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const userEmail = await authRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      (req as any).orgRole = 'owner';
      next();
      return;
    }

    // 检查组织成员角色
    const membership = await orgRepo.findUserMembership(orgId, userId);

    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json(Errors.forbidden());
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
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const projectIdParam = req.params.id || req.params.projectId;
    const projectId = parseInt(Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam || '', 10);

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const userEmail = await authRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      next();
      return;
    }

    // 获取项目所属组织
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查组织成员角色
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);

    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json(Errors.forbidden());
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
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const userEmail = await authRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      next();
      return;
    }

    // 检查用户是否是任何组织的 owner
    const isOwner = await orgRepo.isOwnerOfAny(userId);
    if (!isOwner) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    next();
  };
}