import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { OrganizationRepository } from './repository.js';
import { AuthRepository } from '../auth/repository.js';
import { ParamError, NotFoundError, PermissionError, ConflictError } from '../../core/errors/index.js';
import { getConfig } from '../../core/config.js';
import type { CreateOrganizationInput, UpdateOrganizationInput } from './schemas.js';
import type { OrganizationWithRole, OrganizationDetail } from './types.js';

@singleton()
export class OrganizationService {
  constructor(
    @inject(OrganizationRepository) private readonly repo: OrganizationRepository,
    @inject(AuthRepository) private readonly userRepo: AuthRepository
  ) {}

  async create(userId: number, input: CreateOrganizationInput): Promise<{ id: number; name: string; createdBy: number; createdAt: string }> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    // 检查用户是否有权创建组织（超管或现有组织的 owner）
    const config = getConfig();
    const userEmail = await this.userRepo.findEmailById(userId);
    const isAdmin = userEmail && config.adminEmails?.includes(userEmail);
    const isOrgOwner = await this.repo.isOwnerOfAny(userId);

    if (!isAdmin && !isOrgOwner) {
      throw new PermissionError('只有组织 owner 或管理员可以创建组织');
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

    // 检查用户是否是组织成员
    const membership = await this.repo.findUserMembership(orgId, userId);
    const userEmail = await this.userRepo.findEmailById(userId);
    const config = getConfig();
    const isAdmin = userEmail && config.adminEmails?.includes(userEmail);

    if (!membership && !isAdmin) {
      throw new PermissionError('您不是该组织的成员');
    }

    const members = await this.repo.findMembers(orgId);
    return {
      ...org,
      createdAt: org.createdAt ?? new Date().toISOString(),
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
    const userEmail = await this.userRepo.findEmailById(userId);
    const config = getConfig();
    const isAdmin = userEmail && config.adminEmails?.includes(userEmail);

    if (!isAdmin && (!membership || membership.role !== 'owner')) {
      throw new PermissionError('只有组织 owner 可以修改名称');
    }

    const updated = await this.repo.updateName(orgId, trimmedName);
    return { id: updated.id, name: updated.name };
  }

  async delete(orgId: number, userId: number): Promise<void> {
    const membership = await this.repo.findUserMembership(orgId, userId);
    const userEmail = await this.userRepo.findEmailById(userId);
    const config = getConfig();
    const isAdmin = userEmail && config.adminEmails?.includes(userEmail);

    if (!isAdmin && (!membership || membership.role !== 'owner')) {
      throw new PermissionError('只有组织 owner 可以删除组织');
    }

    await this.repo.delete(orgId);
  }
}