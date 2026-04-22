import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { OrganizationRepository } from './repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { ParamError, NotFoundError, PermissionError, ConflictError } from '../../core/errors/index.js';
import type { CreateOrganizationInput, UpdateOrganizationInput, InviteMemberInput } from './schemas.js';
import type { OrganizationWithRole, OrganizationDetail, OrganizationInvitationWithUser } from './types.js';

@singleton()
export class OrganizationService {
  constructor(
    @inject(OrganizationRepository) private readonly repo: OrganizationRepository,
    @inject(PermissionService) private readonly permissionService: PermissionService
  ) {}

  private async isAdminOrOwner(orgId: number, userId: number): Promise<boolean> {
    if (await this.permissionService.isSuperAdmin(userId)) return true;
    const membership = await this.repo.findUserMembership(orgId, userId);
    return membership?.role === 'owner';
  }

  private async isMemberOrAdmin(orgId: number, userId: number): Promise<boolean> {
    if (await this.permissionService.isSuperAdmin(userId)) return true;
    const membership = await this.repo.findUserMembership(orgId, userId);
    return !!membership;
  }

  async create(userId: number, input: CreateOrganizationInput): Promise<{ id: number; name: string; createdBy: number; createdAt: string }> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    const org = await this.repo.createWithOwner(trimmedName, userId);
    return {
      ...org,
      createdAt: org.createdAt ?? new Date().toISOString(),
    };
  }

  async findByUserId(userId: number): Promise<OrganizationWithRole[]> {
    return this.repo.findByUserId(userId);
  }

  async findById(orgId: number, userId: number): Promise<OrganizationDetail> {
    const org = await this.repo.findById(orgId);
    if (!org) {
      throw new NotFoundError('组织');
    }

    if (!await this.isMemberOrAdmin(orgId, userId)) {
      throw new PermissionError('您不是该组织的成员');
    }

    const members = await this.repo.findMembers(orgId);
    const isSuperAdmin = await this.permissionService.isSuperAdmin(userId);
    const membership = await this.repo.findUserMembership(orgId, userId);
    const role = membership?.role ?? (isSuperAdmin ? 'owner' as const : 'member' as const);
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

    if (!await this.isAdminOrOwner(orgId, userId)) {
      throw new PermissionError('只有组织 owner 可以修改名称');
    }

    const updated = await this.repo.updateName(orgId, trimmedName);
    return { id: updated.id, name: updated.name };
  }

  async delete(orgId: number, userId: number): Promise<void> {
    if (!await this.isAdminOrOwner(orgId, userId)) {
      throw new PermissionError('只有组织 owner 可以删除组织');
    }

    await this.repo.delete(orgId);
  }

  async inviteMember(orgId: number, userId: number, input: InviteMemberInput): Promise<{ id: number; organizationId: number; email: string; role: string; status: string; createdAt: string }> {
    if (!await this.isAdminOrOwner(orgId, userId)) {
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
    if (!await this.isMemberOrAdmin(orgId, userId)) {
      throw new PermissionError('您不是该组织的成员');
    }

    return this.repo.findInvitationsByOrgId(orgId);
  }

  async cancelInvitation(orgId: number, invId: number, userId: number): Promise<void> {
    if (!await this.isAdminOrOwner(orgId, userId)) {
      throw new PermissionError('只有组织 owner 可以取消邀请');
    }

    await this.repo.cancelInvitation(invId);
  }

  async getMyInvitations(userId: number): Promise<OrganizationInvitationWithUser[]> {
    const email = await this.permissionService.getUserEmail(userId);
    if (!email) throw new NotFoundError('用户');
    return this.repo.findPendingInvitationsForEmail(email);
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
}