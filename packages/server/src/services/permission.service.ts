import { UserRepository } from '../repositories/user.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { PermissionError, NotFoundError } from '../utils/errors.js';
import type { SelectOrganizationMember } from '../db/schema/index.js';
import type { SelectProject } from '../db/schema/index.js';

type OrgRole = 'owner' | 'developer' | 'member';

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

export class PermissionService {
  private userRepo = new UserRepository();
  private orgRepo = new OrganizationRepository();
  private projectRepo = new ProjectRepository();

  /**
   * 检查用户是否是超级管理员
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    const email = await this.userRepo.findEmailById(userId);
    return email ? isSuperAdmin(email) : false;
  }

  /**
   * 检查用户在组织中的角色
   * @throws PermissionError 如果用户无权限
   */
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

  /**
   * 检查用户是否有项目访问权限
   * @returns 项目信息
   * @throws NotFoundError 如果项目不存在
   * @throws PermissionError 如果无权限
   */
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

  /**
   * 检查用户是否是组织的 owner
   */
  async checkOrgOwner(userId: number, orgId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有组织 owner 可以执行此操作');
    }
  }

  /**
   * 检查用户是否可以创建组织
   */
  async checkCanCreateOrg(userId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const isOwner = await this.orgRepo.isOwnerOfAny(userId);
    if (!isOwner) {
      throw new PermissionError('只有组织 owner 或超级管理员可以创建组织');
    }
  }

  /**
   * 获取用户在组织中的角色（超管返回 'owner'）
   */
  async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
    if (await this.isSuperAdmin(userId)) {
      return 'owner';
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    return membership?.role ?? null;
  }
}