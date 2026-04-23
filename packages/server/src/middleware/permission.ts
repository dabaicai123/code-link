import "reflect-metadata";
import { container } from "tsyringe";
import type { Request, Response, NextFunction } from 'express';
import { AuthRepository } from '../modules/auth/repository.js';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { ROLE_HIERARCHY, hasRole } from '../utils/roles.js';
import { AuthError, PermissionError, ParamError, NotFoundError } from '../core/errors/index.js';
import { parseIdParam } from '../utils/params.js';
import type { OrgRole, SelectProject } from '../db/schema/index.js';

function getAuthRepo() { return container.resolve(AuthRepository); }
function getOrgRepo() { return container.resolve(OrganizationRepository); }
function getProjectRepo() { return container.resolve(ProjectRepository); }

interface ProjectAccessResult {
  projectId: number;
  userId: number;
  project: SelectProject;
  membership: { role: OrgRole };
}

export function requireProjectId(req: Request): number | null {
  return parseIdParam(req.params.id || req.params.projectId);
}

export async function getProjectAccess(
  projectId: number,
  userId: number
): Promise<ProjectAccessResult> {
  const project = await getProjectRepo().findById(projectId);
  if (!project) throw new NotFoundError('项目');

  const userEmail = await getAuthRepo().findEmailById(userId);
  if (userEmail && isSuperAdmin(userEmail)) {
    return { projectId, userId, project, membership: { role: 'owner' as OrgRole } };
  }

  const membership = await getOrgRepo().findUserMembership(project.organizationId, userId);
  if (!membership) throw new PermissionError('您没有权限访问该项目');

  return { projectId, userId, project, membership };
}

export function createProjectAccessMiddleware(minRole: OrgRole = 'member') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const projectId = requireProjectId(req);

    if (!userId) throw new AuthError();
    if (projectId === null) throw new ParamError('项目 ID 无效');

    const result = await getProjectAccess(projectId, userId);

    if (!hasRole(result.membership.role, minRole)) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }

    req.project = result.project;
    req.membership = result.membership;
    next();
  };
}

export function createOrganizationAccessMiddleware(minRole: OrgRole = 'member') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const orgId = parseIdParam(req.params.orgId || req.params.id || req.body.organization_id);

    if (!userId) throw new AuthError();
    if (orgId === null) throw new ParamError('组织 ID 无效');

    const userEmail = await getAuthRepo().findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      req.orgRole = 'owner';
      next();
      return;
    }

    const membership = await getOrgRepo().findUserMembership(orgId, userId);
    if (!membership) throw new PermissionError('您不是该组织的成员');

    if (!hasRole(membership.role, minRole)) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }

    req.orgRole = membership.role;
    next();
  };
}