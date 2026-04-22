import "reflect-metadata";
import { singleton, inject, delay } from 'tsyringe';
import { OrganizationRepository } from './repository.js';
import { AuthService } from '../auth/auth.module.js';
import { PermissionService } from '../../shared/permission.service.js';
import { ParamError, NotFoundError, PermissionError, ConflictError } from '../../core/errors/index.js';
import type { PaginatedResult } from '../../core/database/pagination.js';
import type { OrgRole } from '../../db/schema/index.js';
import type { CreateOrganizationInput, UpdateOrganizationInput, InviteMemberInput } from './schemas.js';
import type { OrganizationWithRole, OrganizationDetail, OrganizationInvitationWithUser } from './types.js';

@singleton()
export class OrganizationService {
  constructor(
    @inject(OrganizationRepository) private readonly repo: OrganizationRepository,
    @inject(AuthService) private readonly authService: AuthService,
    @inject(delay(() => PermissionService)) private readonly permService: PermissionService
  ) {}

  async create(userId: number, input: CreateOrganizationInput): Promise<{ id: number; name: string; createdBy: number; createdAt: string }> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    // 任何已登录用户都可以创建组织
    const org = await this.repo.createWithOwner(trimmedName, userId);
    return {
      ...org,
      createdAt: org.createdAt ?? new Date().toISOString(),
    };
  }

  async findByUserId(userId: number, page?: number, limit?: number): Promise<PaginatedResult<OrganizationWithRole>> {
    return this.repo.findByUserId(userId, page, limit);
  }

  async findById(orgId: number, userId: number): Promise<OrganizationDetail> {
    const org = await this.repo.findById(orgId);
    if (!org) {
      throw new NotFoundError('组织');
    }

    // 检查用户是否是组织成员
    const membership = await this.repo.findUserMembership(orgId, userId);
    const isAdmin = await this.permService.isSuperAdmin(userId);

    if (!membership && !isAdmin) {
      throw new PermissionError('您不是该组织的成员');
    }

    const members = await this.repo.findMembers(orgId);
    const role = membership?.role ?? (isAdmin ? 'owner' as const : 'member' as const);
    return {
      ...org,
      createdAt: org.createdAt ?? new Date().toISOString(),
      role,
      members,
    };
  }

  async updateName(orgId: number, userId: number, input: UpdateOrganizationInput): Promise<{ id: number; name: string }> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }

    // 检查是否是 owner
    const membership = await this.repo.findUserMembership(orgId, userId);
    const isAdmin = await this.permService.isSuperAdmin(userId);

    if (!isAdmin && (!membership || membership.role !== 'owner')) {
      throw new PermissionError('只有组织 owner 可以修改名称');
    }

    const updated = await this.repo.updateName(orgId, trimmedName);
    return { id: updated.id, name: updated.name };
  }

  async delete(orgId: number, userId: number): Promise<void> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    const isAdmin = await this.permService.isSuperAdmin(userId);

    if (!isAdmin && (!membership || membership.role !== 'owner')) {
      throw new PermissionError('只有组织 owner 可以删除组织');
    }

    await this.repo.delete(orgId);
  }

  // === Invitation Methods ===

  async inviteMember(orgId: number, userId: number, input: InviteMemberInput): Promise<{ id: number; organizationId: number; email: string; role: string; status: string; createdAt: string }> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    const isAdmin = await this.permService.isSuperAdmin(userId);

    if (!isAdmin && (!membership || membership.role !== 'owner')) {
      throw new PermissionError('只有组织 owner 可以邀请成员');
    }

    const exists = await this.repo.hasPendingInvitation(orgId, input.email);
    if (exists) {
      throw new ConflictError('该邮箱已有待处理邀请');
    }

    const inv = await this.repo.createInvitation(orgId, input.email, input.role, userId);
    return { ...inv, createdAt: inv.createdAt ?? new Date().toISOString() };
  }

  async getInvitations(orgId: number, userId: number): Promise<OrganizationInvitationWithUser[]> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    const isAdmin = await this.permService.isSuperAdmin(userId);

    if (!isAdmin && !membership) {
      throw new PermissionError('您不是该组织的成员');
    }

    return this.repo.findInvitationsByOrgId(orgId);
  }

  async cancelInvitation(orgId: number, invId: number, userId: number): Promise<void> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    const isAdmin = await this.permService.isSuperAdmin(userId);

    if (!isAdmin && (!membership || membership.role !== 'owner')) {
      throw new PermissionError('只有组织 owner 可以取消邀请');
    }

    await this.repo.cancelInvitation(invId);
  }

  async getMyInvitations(userId: number): Promise<OrganizationInvitationWithUser[]> {
    const user = await this.authService.findById(userId);
    if (!user) throw new NotFoundError('用户');
    return this.repo.findPendingInvitationsForEmail(user.email);
  }

  async acceptInvitation(invId: number, userId: number): Promise<{ organizationId: number; organizationName: string }> {
    const inv = await this.repo.findInvitationById(invId);
    if (!inv) throw new NotFoundError('邀请');
    if (inv.status !== 'pending') throw new ConflictError('邀请已处理');

    await this.repo.acceptInvitation(invId, userId);

    const org = await this.repo.findById(inv.organizationId);
    return { organizationId: inv.organizationId, organizationName: org?.name ?? '' };
  }

  async declineInvitation(invId: number, userId: number): Promise<void> {
    const inv = await this.repo.findInvitationById(invId);
    if (!inv) throw new NotFoundError('邀请');
    if (inv.status !== 'pending') throw new ConflictError('邀请已处理');

    await this.repo.declineInvitation(invId);
  }

  // ==================== Facade methods for cross-module access ====================

  async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    return membership?.role ?? null;
  }

  async isOrgOwner(userId: number, orgId: number): Promise<boolean> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    return membership?.role === 'owner';
  }
}