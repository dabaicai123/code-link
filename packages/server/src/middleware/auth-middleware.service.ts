import 'reflect-metadata';
import { singleton, inject } from 'tsyringe';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { hasRole } from '../utils/roles.js';
import type { OrgRole } from '../db/schema/index.js';
import type { SelectProject } from '../db/schema/index.js';
import { AuthService } from '../modules/auth/auth.module.js';

@singleton()
export class AuthMiddlewareService {
  constructor(
    @inject(AuthService) private readonly authService: AuthService,
    @inject(OrganizationRepository) private readonly orgRepo: OrganizationRepository,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
  ) {}

  verifyToken(token: string): Promise<number> {
    return this.authService.verifyToken(token);
  }

  async isSuperAdminUser(userId: number): Promise<boolean> {
    return this.authService.isSuperAdminCheck(userId);
  }

  async checkOrgMembership(userId: number, orgId: number, minRole: OrgRole): Promise<{ role: OrgRole } | undefined> {
    if (await this.isSuperAdminUser(userId)) return { role: 'owner' };
    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership) return undefined;
    if (!hasRole(membership.role, minRole)) return undefined;
    return membership;
  }

  async findProjectById(projectId: number): Promise<SelectProject | undefined> {
    return this.projectRepo.findById(projectId);
  }

  async checkProjectMembership(userId: number, projectId: number, minRole: OrgRole): Promise<SelectProject | undefined> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) return undefined;
    if (await this.isSuperAdminUser(userId)) return project;
    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) return undefined;
    if (!hasRole(membership.role, minRole)) return undefined;
    return project;
  }

  async canCreateOrg(userId: number): Promise<boolean> {
    if (await this.isSuperAdminUser(userId)) return true;
    return this.orgRepo.isOwnerOfAny(userId);
  }
}