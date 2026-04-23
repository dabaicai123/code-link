import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { AuthService } from '../modules/auth/auth.module.js';
import { PermissionError } from '../core/errors/index.js';
import { ROLE_HIERARCHY, hasRole } from '../utils/roles.js';
import type { OrgRole } from '../db/schema/index.js';

@singleton()
export class PermissionService {
  constructor(
    @inject(AuthService) private readonly authService: AuthService
  ) {}

  async isSuperAdmin(userId: number): Promise<boolean> {
    return this.authService.isSuperAdminCheck(userId);
  }

  async requireOrgRole(userId: number, role: OrgRole | null, minRole: OrgRole): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }
    if (!role) {
      throw new PermissionError('您不是该组织的成员');
    }
    if (!hasRole(role, minRole)) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }
  }

  async requireOrgOwner(userId: number, role: OrgRole | null): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }
    if (role !== 'owner') {
      throw new PermissionError('只有组织 owner 可以执行此操作');
    }
  }

  async requireProjectAccess(userId: number, role: OrgRole | null): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }
    if (!role) {
      throw new PermissionError('您没有权限访问该项目');
    }
  }
}