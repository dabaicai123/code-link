import "reflect-metadata";
import { container } from "tsyringe";
import type { Request, Response, NextFunction } from 'express';
import { AuthError, PermissionError, ParamError } from '../core/errors/index.js';
import { AuthService } from '../modules/auth/auth.module.js';
import { AuthMiddlewareService } from './auth-middleware.service.js';
import { parseIdParam } from '../utils/params.js';
import type { OrgRole } from '../db/schema/index.js';

let _authService: AuthService | null = null;
function getAuthService(): AuthService {
  return _authService ??= container.resolve(AuthService);
}

let _authMiddlewareService: AuthMiddlewareService | null = null;
function getAuthMiddlewareService(): AuthMiddlewareService {
  return _authMiddlewareService ??= container.resolve(AuthMiddlewareService);
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError('请提供认证令牌');
  }

  const token = header.slice(7);
  if (!token) {
    throw new AuthError('认证令牌为空');
  }

  const userId = await getAuthService().verifyToken(token);
  req.userId = userId;
  next();
}

export function createOrgMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const orgId = parseIdParam(req.params.orgId || req.params.id || req.body.organization_id);

    if (!userId) throw new AuthError();
    if (orgId === null) throw new ParamError('组织 ID 无效');

    const membership = await getAuthMiddlewareService().checkOrgMembership(userId, orgId, minRole);
    if (!membership) throw new PermissionError('您不是该组织的成员或角色不足');

    req.orgRole = membership.role;
    next();
  };
}

export function createProjectMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const projectId = parseIdParam(req.params.id || req.params.projectId);

    if (!userId) throw new AuthError();
    if (projectId === null) throw new ParamError('项目 ID 无效');

    const project = await getAuthMiddlewareService().checkProjectMembership(userId, projectId, minRole);
    if (!project) throw new PermissionError('您没有权限访问该项目');

    next();
  };
}

export function createCanCreateOrgMiddleware() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) throw new AuthError();

    const canCreate = await getAuthMiddlewareService().canCreateOrg(userId);
    if (!canCreate) throw new PermissionError('您没有权限创建组织');

    next();
  };
}