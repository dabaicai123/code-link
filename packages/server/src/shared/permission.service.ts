import "reflect-metadata";
import { singleton, inject, delay } from 'tsyringe';
import { OrganizationService } from '../modules/organization/organization.module.js';
import { AuthService } from '../modules/auth/auth.module.js';
import { ProjectService } from '../modules/project/project.module.js';
import { PermissionError, NotFoundError } from '../core/errors/index.js';
import { ROLE_HIERARCHY, hasRole } from '../utils/roles.js';
import type { SelectProject, OrgRole } from '../db/schema/index.js';

@singleton()
export class PermissionService {
  constructor(
    @inject(AuthService) private readonly authService: AuthService,
    @inject(delay(() => OrganizationService)) private readonly orgService: OrganizationService,
    @inject(delay(() => ProjectService)) private readonly projectService: ProjectService
  ) {}

  async isSuperAdmin(userId: number): Promise<boolean> {
    return this.authService.isSuperAdminCheck(userId);
  }

  async checkOrgRole(userId: number, orgId: number, minRole: OrgRole): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgService.getOrgRole(userId, orgId);
    if (!membership) {
      throw new PermissionError('您不是该组织的成员');
    }

    if (!hasRole(membership, minRole)) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }
  }

  async checkProjectAccess(userId: number, projectId: number): Promise<SelectProject> {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    if (await this.isSuperAdmin(userId)) {
      return project;
    }

    const membership = await this.orgService.getOrgRole(userId, project.organizationId);
    if (!membership) {
      throw new PermissionError('您没有权限访问该项目');
    }

    return project;
  }

  async checkOrgOwner(userId: number, orgId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const isOwner = await this.orgService.isOrgOwner(userId, orgId);
    if (!isOwner) {
      throw new PermissionError('只有组织 owner 可以执行此操作');
    }
  }

  async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
    if (await this.isSuperAdmin(userId)) {
      return 'owner';
    }

    return this.orgService.getOrgRole(userId, orgId);
  }
}
