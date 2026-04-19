import "reflect-metadata";
import { singleton, inject } from "tsyringe";
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { PermissionService } from './permission.service.js';
import { NotFoundError, ParamError, ConflictError } from '../utils/errors.js';
import type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
} from '../repositories/organization.repository.js';
import type { SelectOrganization } from '../db/schema/index.js';
import type { OrgRole } from '../types.js';

export interface CreateOrganizationInput {
  name: string;
}

export interface UpdateOrganizationInput {
  name: string;
}

export interface InviteMemberInput {
  email: string;
  role: OrgRole;
}

export interface UpdateMemberRoleInput {
  userId: number;
  role: OrgRole;
}

export interface OrganizationDetail {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  members: OrganizationMemberWithUser[];
}

@singleton()
export class OrganizationService {
  constructor(
    @inject(OrganizationRepository) private orgRepo: OrganizationRepository,
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(PermissionService) private permService: PermissionService
  ) {}

  /**
   * 创建组织
   */
  async create(userId: number, input: CreateOrganizationInput): Promise<SelectOrganization> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    await this.permService.checkCanCreateOrg(userId);
    return this.orgRepo.createWithOwner(trimmedName, userId);
  }

  /**
   * 获取用户所属的组织列表
   */
  async findByUserId(userId: number): Promise<OrganizationWithRole[]> {
    return this.orgRepo.findByUserId(userId);
  }

  /**
   * 获取组织详情
   */
  async findById(orgId: number, userId: number): Promise<OrganizationDetail> {
    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new NotFoundError('组织');
    }

    await this.permService.checkOrgRole(userId, orgId, 'member');

    const members = await this.orgRepo.findMembers(orgId);
    return { ...org, members };
  }

  /**
   * 更新组织名称
   */
  async updateName(orgId: number, userId: number, input: UpdateOrganizationInput): Promise<SelectOrganization> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    await this.permService.checkOrgOwner(userId, orgId);
    return this.orgRepo.updateName(orgId, trimmedName);
  }

  /**
   * 删除组织
   */
  async delete(orgId: number, userId: number): Promise<void> {
    await this.permService.checkOrgOwner(userId, orgId);

    const projectCount = await this.orgRepo.countProjects(orgId);
    if (projectCount > 0) {
      throw new ConflictError('组织下还有项目，请先删除或迁移项目');
    }

    await this.orgRepo.delete(orgId);
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(orgId: number, userId: number, input: UpdateMemberRoleInput): Promise<OrganizationMemberWithUser> {
    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!validRoles.includes(input.role)) {
      throw new ParamError('无效的角色，必须是 owner、developer 或 member');
    }

    await this.permService.checkOrgOwner(userId, orgId);

    const targetMembership = await this.orgRepo.findUserMembership(orgId, input.userId);
    if (!targetMembership) {
      throw new NotFoundError('该用户不是组织成员');
    }

    if (targetMembership.role === 'owner' && input.role !== 'owner') {
      const ownerCount = await this.orgRepo.countOwners(orgId);
      if (ownerCount <= 1) {
        throw new ConflictError('不能修改最后一个 owner 的角色');
      }
    }

    await this.orgRepo.updateMemberRole(orgId, input.userId, input.role);

    const members = await this.orgRepo.findMembers(orgId);
    const updatedMember = members.find(m => m.userId === input.userId);
    if (!updatedMember) {
      throw new NotFoundError('成员');
    }

    return updatedMember;
  }

  /**
   * 移除成员
   */
  async removeMember(orgId: number, userId: number, targetUserId: number): Promise<void> {
    await this.permService.checkOrgOwner(userId, orgId);

    if (targetUserId === userId) {
      throw new ConflictError('不能移除自己');
    }

    const targetMembership = await this.orgRepo.findUserMembership(orgId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('该用户不是组织成员');
    }

    if (targetMembership.role === 'owner') {
      const ownerCount = await this.orgRepo.countOwners(orgId);
      if (ownerCount <= 1) {
        throw new ConflictError('不能移除最后一个 owner');
      }
    }

    await this.orgRepo.removeMember(orgId, targetUserId);
  }

  /**
   * 邀请成员
   */
  async inviteMember(orgId: number, userId: number, input: InviteMemberInput): Promise<OrganizationInvitationWithUser> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!input.email || !emailRegex.test(input.email)) {
      throw new ParamError('邮箱地址格式不正确');
    }

    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!validRoles.includes(input.role)) {
      throw new ParamError('无效的角色，必须是 owner、developer 或 member');
    }

    await this.permService.checkOrgOwner(userId, orgId);

    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.orgRepo.findUserMembership(orgId, existingUser.id);
      if (existingMembership) {
        throw new ConflictError('该用户已是组织成员');
      }
    }

    const hasPending = await this.orgRepo.hasPendingInvitation(orgId, input.email);
    if (hasPending) {
      throw new ConflictError('该邮箱已有待处理的邀请');
    }

    await this.orgRepo.createInvitation({
      organizationId: orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      invitedBy: userId,
      status: 'pending',
    });

    const invitations = await this.orgRepo.findPendingInvitationsByOrg(orgId);
    const invitation = invitations.find(inv => inv.email === input.email.toLowerCase());
    if (!invitation) {
      throw new ConflictError('邀请创建失败');
    }

    return invitation;
  }

  /**
   * 获取组织的待处理邀请列表
   */
  async findPendingInvitations(orgId: number, userId: number): Promise<OrganizationInvitationWithUser[]> {
    await this.permService.checkOrgOwner(userId, orgId);
    return this.orgRepo.findPendingInvitationsByOrg(orgId);
  }

  /**
   * 取消邀请
   */
  async cancelInvitation(orgId: number, userId: number, invId: number): Promise<void> {
    await this.permService.checkOrgOwner(userId, orgId);
    await this.orgRepo.deleteInvitation(invId, orgId);
  }

  /**
   * 获取用户收到的邀请列表
   */
  async findUserInvitations(userId: number): Promise<OrganizationInvitationWithUser[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户');
    }

    return this.orgRepo.findPendingInvitationsByEmail(user.email);
  }

  /**
   * 接受邀请
   */
  async acceptInvitation(userId: number, invId: number): Promise<{ organization: SelectOrganization; member: OrganizationMemberWithUser }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户');
    }

    const invitation = await this.orgRepo.findPendingInvitation(invId, user.email);
    if (!invitation) {
      throw new NotFoundError('邀请');
    }

    return this.orgRepo.acceptInvitationInTransaction(
      invId,
      invitation.organizationId,
      userId,
      invitation.role,
      invitation.invitedBy
    );
  }

  /**
   * 拒绝邀请
   */
  async declineInvitation(userId: number, invId: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户');
    }

    const result = await this.orgRepo.findPendingInvitation(invId, user.email);
    if (!result) {
      throw new NotFoundError('邀请');
    }

    await this.orgRepo.updateInvitationStatus(invId, 'declined');
  }
}