import { OrganizationRepository } from '../repositories/organization.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
} from '../repositories/organization.repository.js';
import type { SelectOrganization } from '../db/schema/index.js';

export interface CreateOrganizationInput {
  name: string;
}

export interface UpdateOrganizationInput {
  name: string;
}

export interface InviteMemberInput {
  email: string;
  role: 'owner' | 'developer' | 'member';
}

export interface UpdateMemberRoleInput {
  userId: number;
  role: 'owner' | 'developer' | 'member';
}

export interface OrganizationDetail {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  members: OrganizationMemberWithUser[];
}

export class OrganizationService {
  private orgRepo = new OrganizationRepository();
  private userRepo = new UserRepository();

  /**
   * 创建组织
   */
  async create(userId: number, input: CreateOrganizationInput): Promise<SelectOrganization> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new Error('组织名称不能超过 100 个字符');
    }

    // 检查用户是否有权限创建组织
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const isSuper = isSuperAdmin(user.email);
    if (!isSuper) {
      const isOwner = await this.orgRepo.isOwnerOfAny(userId);
      if (!isOwner) {
        throw new Error('只有组织 owner 或超级管理员可以创建组织');
      }
    }

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
      throw new Error('组织不存在');
    }

    // 检查访问权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership) {
        throw new Error('您不是该组织的成员');
      }
    }

    const members = await this.orgRepo.findMembers(orgId);
    return { ...org, members };
  }

  /**
   * 更新组织名称
   */
  async updateName(orgId: number, userId: number, input: UpdateOrganizationInput): Promise<SelectOrganization> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new Error('组织名称不能超过 100 个字符');
    }

    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以修改组织名称');
      }
    }

    return this.orgRepo.updateName(orgId, trimmedName);
  }

  /**
   * 删除组织
   */
  async delete(orgId: number, userId: number): Promise<void> {
    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以删除组织');
      }
    }

    // 检查组织下是否有项目
    const projectCount = await this.orgRepo.countProjects(orgId);
    if (projectCount > 0) {
      throw new Error('组织下还有项目，请先删除或迁移项目');
    }

    await this.orgRepo.delete(orgId);
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(orgId: number, userId: number, input: UpdateMemberRoleInput): Promise<OrganizationMemberWithUser> {
    const validRoles = ['owner', 'developer', 'member'];
    if (!validRoles.includes(input.role)) {
      throw new Error('无效的角色，必须是 owner、developer 或 member');
    }

    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以修改成员角色');
      }
    }

    // 检查目标成员是否存在
    const targetMembership = await this.orgRepo.findUserMembership(orgId, input.userId);
    if (!targetMembership) {
      throw new Error('该用户不是组织成员');
    }

    // 检查是否是最后一个 owner
    if (targetMembership.role === 'owner' && input.role !== 'owner') {
      const ownerCount = await this.orgRepo.countOwners(orgId);
      if (ownerCount <= 1) {
        throw new Error('不能修改最后一个 owner 的角色');
      }
    }

    await this.orgRepo.updateMemberRole(orgId, input.userId, input.role);

    // 获取更新后的成员信息
    const members = await this.orgRepo.findMembers(orgId);
    const updatedMember = members.find(m => m.userId === input.userId);
    if (!updatedMember) {
      throw new Error('成员不存在');
    }

    return updatedMember;
  }

  /**
   * 移除成员
   */
  async removeMember(orgId: number, userId: number, targetUserId: number): Promise<void> {
    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以移除成员');
      }
    }

    // 不能移除自己
    if (targetUserId === userId) {
      throw new Error('不能移除自己');
    }

    // 检查目标成员是否存在
    const targetMembership = await this.orgRepo.findUserMembership(orgId, targetUserId);
    if (!targetMembership) {
      throw new Error('该用户不是组织成员');
    }

    // 检查是否是最后一个 owner
    if (targetMembership.role === 'owner') {
      const ownerCount = await this.orgRepo.countOwners(orgId);
      if (ownerCount <= 1) {
        throw new Error('不能移除最后一个 owner');
      }
    }

    await this.orgRepo.removeMember(orgId, targetUserId);
  }

  /**
   * 邀请成员
   */
  async inviteMember(orgId: number, userId: number, input: InviteMemberInput): Promise<OrganizationInvitationWithUser> {
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!input.email || !emailRegex.test(input.email)) {
      throw new Error('邮箱地址格式不正确');
    }

    const validRoles = ['owner', 'developer', 'member'];
    if (!validRoles.includes(input.role)) {
      throw new Error('无效的角色，必须是 owner、developer 或 member');
    }

    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以邀请成员');
      }
    }

    // 检查用户是否已是组织成员
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.orgRepo.findUserMembership(orgId, existingUser.id);
      if (existingMembership) {
        throw new Error('该用户已是组织成员');
      }
    }

    // 检查是否已有待处理邀请
    const hasPending = await this.orgRepo.hasPendingInvitation(orgId, input.email);
    if (hasPending) {
      throw new Error('该邮箱已有待处理的邀请');
    }

    await this.orgRepo.createInvitation({
      organizationId: orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      invitedBy: userId,
      status: 'pending',
    });

    // 获取邀请信息
    const invitations = await this.orgRepo.findPendingInvitationsByOrg(orgId);
    const invitation = invitations.find(inv => inv.email === input.email.toLowerCase());
    if (!invitation) {
      throw new Error('邀请创建失败');
    }

    return invitation;
  }

  /**
   * 获取组织的待处理邀请列表
   */
  async findPendingInvitations(orgId: number, userId: number): Promise<OrganizationInvitationWithUser[]> {
    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以查看邀请列表');
      }
    }

    return this.orgRepo.findPendingInvitationsByOrg(orgId);
  }

  /**
   * 取消邀请
   */
  async cancelInvitation(orgId: number, userId: number, invId: number): Promise<void> {
    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(orgId, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以取消邀请');
      }
    }

    await this.orgRepo.deleteInvitation(invId, orgId);
  }

  /**
   * 获取用户收到的邀请列表
   */
  async findUserInvitations(userId: number): Promise<OrganizationInvitationWithUser[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    return this.orgRepo.findPendingInvitationsByEmail(user.email);
  }

  /**
   * 接受邀请
   */
  async acceptInvitation(userId: number, invId: number): Promise<{ organization: SelectOrganization; member: OrganizationMemberWithUser }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const invitation = await this.orgRepo.findPendingInvitation(invId, user.email);
    if (!invitation) {
      throw new Error('邀请不存在或已处理');
    }

    // 使用事务
    await this.orgRepo.updateInvitationStatus(invId, 'accepted');
    await this.orgRepo.addMember({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
    });

    const org = await this.orgRepo.findById(invitation.organizationId);
    if (!org) {
      throw new Error('组织不存在');
    }

    const members = await this.orgRepo.findMembers(invitation.organizationId);
    const member = members.find(m => m.userId === userId);
    if (!member) {
      throw new Error('成员添加失败');
    }

    return { organization: org, member };
  }

  /**
   * 拒绝邀请
   */
  async declineInvitation(userId: number, invId: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const result = await this.orgRepo.findPendingInvitation(invId, user.email);
    if (!result) {
      throw new Error('邀请不存在或已处理');
    }

    await this.orgRepo.updateInvitationStatus(invId, 'declined');
  }
}