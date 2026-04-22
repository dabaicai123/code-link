import "reflect-metadata";
import { container } from "tsyringe";
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../core/logger/index.js';
import { Errors } from '../core/errors/index.js';
import { getConfig } from '../core/config.js';
import { AuthMiddlewareService } from './auth-middleware.service.js';
import type { OrgRole } from '../db/schema/index.js';

const logger = createLogger('auth');

// 延迟获取 AuthMiddlewareService 实例（避免模块加载时解析）
let _authService: AuthMiddlewareService | null = null;
function getAuthService(): AuthMiddlewareService {
  return _authService ??= container.resolve(AuthMiddlewareService);
}

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
    logger.warn('Token verification failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json(Errors.unauthorized());
  }
}

/**
 * 创建组织权限检查中间件
 * @param minRole 最低需要的角色
 */
export function createOrgMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authService = getAuthService();
    const userId = req.userId;
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

    const membership = await authService.checkOrgMembership(userId, orgId, minRole);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    req.orgRole = membership.role;
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
    const authService = getAuthService();
    const userId = req.userId;
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

    const project = await authService.checkProjectMembership(userId, projectId, minRole);
    if (!project) {
      // 区分：项目不存在 vs 不是成员/角色不足
      const exists = await authService.findProjectById(projectId);
      if (!exists) {
        res.status(404).json(Errors.notFound('项目'));
      } else {
        res.status(403).json(Errors.forbidden());
      }
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
    const authService = getAuthService();
    const userId = req.userId;

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    const canCreate = await authService.canCreateOrg(userId);
    if (!canCreate) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    next();
  };
}