import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { AuthRepository } from '../modules/auth/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { ROLE_HIERARCHY } from '../utils/roles.js';
import { PermissionError, NotFoundError } from '../core/errors/index.js';
import { getConfig } from '../core/config.js';
import type { SelectProject, OrgRole } from '../db/schema/index.js';

@singleton()
export class PermissionService {
  constructor(
    @inject(AuthRepository) private readonly userRepo: AuthRepository,
    @inject(OrganizationRepository) private readonly orgRepo: OrganizationRepository,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository
  ) {}

  async getUserEmail(userId: number): Promise<string | undefined> {
    return this.userRepo.findEmailById(userId);
  }

  async isSuperAdmin(userId: number): Promise<boolean> {
    const email = await this.getUserEmail(userId);
    return email ? getConfig().adminEmails?.includes(email) ?? false : false;
  }

  async checkOrgRole(userId: number, orgId: number, minRole: OrgRole): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership) {
      throw new PermissionError('您不是该组织的成员');
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }
  }

  async checkProjectAccess(userId: number, projectId: number): Promise<SelectProject> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    if (await this.isSuperAdmin(userId)) {
      return project;
    }

    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      throw new PermissionError('您没有权限访问该项目');
    }

    return project;
  }

  async checkOrgOwner(userId: number, orgId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有组织 owner 可以执行此操作');
    }
  }

  async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
    if (await this.isSuperAdmin(userId)) {
      return 'owner';
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    return membership?.role ?? null;
  }
}
