import 'reflect-metadata';
import { singleton, inject } from 'tsyringe';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../modules/auth/repository.js';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { ROLE_HIERARCHY } from '../utils/roles.js';
import { Errors } from '../core/errors/index.js';
import { getConfig } from '../core/config.js';
import type { OrgRole } from '../db/schema/index.js';
import type { SelectProject } from '../db/schema/index.js';

@singleton()
export class AuthMiddlewareService {
  constructor(
    @inject(AuthRepository) private readonly authRepo: AuthRepository,
    @inject(OrganizationRepository) private readonly orgRepo: OrganizationRepository,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
  ) {}

  async verifyToken(token: string): Promise<number> {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload !== 'object' || payload === null || typeof (payload as any).userId !== 'number') {
      throw new Error('无效的令牌');
    }
    return (payload as any).userId;
  }

  async findUserEmail(userId: number): Promise<string | undefined> {
    return this.authRepo.findEmailById(userId);
  }

  async isSuperAdminUser(userId: number): Promise<boolean> {
    const email = await this.authRepo.findEmailById(userId);
    return email ? isSuperAdmin(email) : false;
  }

  async checkOrgMembership(userId: number, orgId: number, minRole: OrgRole): Promise<{ role: OrgRole } | undefined> {
    if (await this.isSuperAdminUser(userId)) return { role: 'owner' };
    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership) return undefined;
    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) return undefined;
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
    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) return undefined;
    return project;
  }

  async canCreateOrg(userId: number): Promise<boolean> {
    if (await this.isSuperAdminUser(userId)) return true;
    return this.orgRepo.isOwnerOfAny(userId);
  }
}