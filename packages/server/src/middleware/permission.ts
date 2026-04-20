// packages/server/src/middleware/permission.ts
import "reflect-metadata";
import { container } from "tsyringe";
import type { Request, Response, NextFunction } from 'express';
import { AuthRepository } from '../modules/auth/repository.js';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { Errors } from '../utils/response.js';
import { parseIdParam } from '../utils/params.js';
import type { OrgRole } from '../types.js';

const authRepo = container.resolve(AuthRepository);
const orgRepo = container.resolve(OrganizationRepository);
const projectRepo = container.resolve(ProjectRepository);

interface ProjectAccessResult {
  projectId: number;
  userId: number;
  project: NonNullable<Awaited<ReturnType<typeof projectRepo.findById>>>;
  membership: { role: OrgRole };
}

/**
 * 解析并验证项目 ID
 */
export function requireProjectId(req: Request): number | null {
  return parseIdParam(req.params.id || req.params.projectId);
}

/**
 * 获取项目访问信息（中间件辅助函数）
 * 返回项目和成员信息，或返回错误响应
 */
export async function getProjectAccess(
  projectId: number,
  userId: number
): Promise<{ success: true; data: ProjectAccessResult } | { success: false; error: { status: number; body: any } }> {
  // 获取项目
  const project = await projectRepo.findById(projectId);
  if (!project) {
    return { success: false, error: { status: 404, body: Errors.notFound('项目') } };
  }

  // 检查用户邮箱判断超级管理员
  const userEmail = await authRepo.findEmailById(userId);
  if (userEmail && isSuperAdmin(userEmail)) {
    // Create a synthetic membership for super admin
    const syntheticMembership: { role: OrgRole } = { role: 'owner' };
    return {
      success: true,
      data: { projectId, userId, project, membership: syntheticMembership }
    };
  }

  // 检查组织成员
  const membership = await orgRepo.findUserMembership(project.organizationId, userId);
  if (!membership) {
    return { success: false, error: { status: 403, body: Errors.forbidden() } };
  }

  return { success: true, data: { projectId, userId, project, membership } };
}

/**
 * 创建项目访问中间件
 * 验证用户是否有权限访问项目，并将项目和成员信息附加到请求对象
 */
export function createProjectAccessMiddleware(minRole: OrgRole = 'member') {
  const roleHierarchy: Record<OrgRole, number> = {
    owner: 3,
    developer: 2,
    member: 1,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const projectId = requireProjectId(req);

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    if (projectId === null) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const result = await getProjectAccess(projectId, userId);

    if (!result.success) {
      res.status(result.error.status).json(result.error.body);
      return;
    }

    // 检查角色权限
    if (roleHierarchy[result.data.membership.role] < roleHierarchy[minRole]) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    // 将信息附加到请求对象
    (req as any).project = result.data.project;
    (req as any).membership = result.data.membership;
    next();
  };
}

/**
 * 组织访问中间件工厂
 */
export function createOrganizationAccessMiddleware(minRole: OrgRole = 'member') {
  const roleHierarchy: Record<OrgRole, number> = {
    owner: 3,
    developer: 2,
    member: 1,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const orgId = parseIdParam(req.params.orgId || req.params.id || req.body.organization_id);

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    if (orgId === null) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    // 检查超级管理员
    const userEmail = await authRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      (req as any).orgRole = 'owner';
      next();
      return;
    }

    // 检查组织成员
    const membership = await orgRepo.findUserMembership(orgId, userId);
    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    (req as any).orgRole = membership.role;
    next();
  };
}
