# Drizzle ORM 数据库重构 - Phase 3: Organization 模块

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Organization 模块，使用 Drizzle ORM 替代原生 SQL，创建 Repository 和 Service 层。

**Architecture:** 三层架构 - Repository（数据访问）、Service（业务逻辑）、Routes（HTTP 处理）。类型安全的数据库操作。

**Tech Stack:** Drizzle ORM, Express

---

## 前置条件

- Phase 1 基础设施已完成
- Phase 2 User/Auth 模块已完成
- Schema 定义在 `packages/server/src/db/schema/`

---

### Task 1: 创建 Organization Repository

**Files:**
- Create: `packages/server/src/repositories/organization.repository.ts`
- Modify: `packages/server/src/repositories/index.ts`

- [ ] **Step 1: 创建 Organization Repository**

```typescript
// packages/server/src/repositories/organization.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb, getSqliteDb } from '../db/index.js';
import {
  organizations,
  organizationMembers,
  organizationInvitations,
  users,
} from '../db/schema/index.js';
import type {
  InsertOrganization,
  SelectOrganization,
  InsertOrganizationMember,
  SelectOrganizationMember,
  InsertOrganizationInvitation,
  SelectOrganizationInvitation,
} from '../db/schema/index.js';

export interface OrganizationWithRole extends SelectOrganization {
  role: 'owner' | 'developer' | 'member';
}

export interface OrganizationMemberWithUser extends SelectOrganizationMember {
  name: string;
  email: string;
  avatar: string | null;
}

export interface OrganizationInvitationWithUser extends SelectOrganizationInvitation {
  organizationName: string;
  invitedByName: string | null;
}

export class OrganizationRepository {
  /**
   * 根据 ID 查找组织
   */
  async findById(id: number): Promise<SelectOrganization | undefined> {
    const db = getDb();
    return db.select().from(organizations).where(eq(organizations.id, id)).get();
  }

  /**
   * 创建组织
   */
  async create(data: InsertOrganization): Promise<SelectOrganization> {
    const db = getDb();
    return db.insert(organizations).values(data).returning().get();
  }

  /**
   * 更新组织名称
   */
  async updateName(id: number, name: string): Promise<SelectOrganization> {
    const db = getDb();
    return db.update(organizations).set({ name }).where(eq(organizations.id, id)).returning().get();
  }

  /**
   * 删除组织
   */
  async delete(id: number): Promise<void> {
    const db = getDb();
    db.delete(organizations).where(eq(organizations.id, id)).run();
  }

  /**
   * 查找用户所属的组织列表
   */
  async findByUserId(userId: number): Promise<OrganizationWithRole[]> {
    const db = getDb();
    return db.select({
      id: organizations.id,
      name: organizations.name,
      createdBy: organizations.createdBy,
      createdAt: organizations.createdAt,
      role: organizationMembers.role,
    })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizations.id, organizationMembers.organizationId)
      )
      .where(eq(organizationMembers.userId, userId));
  }

  /**
   * 查找用户在组织中的成员身份
   */
  async findUserMembership(orgId: number, userId: number): Promise<SelectOrganizationMember | undefined> {
    const db = getDb();
    return db.select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .get();
  }

  /**
   * 查找组织成员列表（带用户信息）
   */
  async findMembers(orgId: number): Promise<OrganizationMemberWithUser[]> {
    const db = getDb();
    return db.select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      invitedBy: organizationMembers.invitedBy,
      joinedAt: organizationMembers.joinedAt,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
    })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId));
  }

  /**
   * 添加组织成员
   */
  async addMember(data: InsertOrganizationMember): Promise<SelectOrganizationMember> {
    const db = getDb();
    return db.insert(organizationMembers).values(data).returning().get();
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(orgId: number, userId: number, role: 'owner' | 'developer' | 'member'): Promise<void> {
    const db = getDb();
    db.update(organizationMembers)
      .set({ role })
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .run();
  }

  /**
   * 删除成员
   */
  async removeMember(orgId: number, userId: number): Promise<void> {
    const db = getDb();
    db.delete(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .run();
  }

  /**
   * 统计组织中的 owner 数量
   */
  async countOwners(orgId: number): Promise<number> {
    const db = getDb();
    const result = db.select({ count: organizationMembers.id })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.role, 'owner')
      ))
      .all();
    return result.length;
  }

  /**
   * 检查用户是否是任何组织的 owner
   */
  async isOwnerOfAny(userId: number): Promise<boolean> {
    const db = getDb();
    const result = db.select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, 'owner')
      ))
      .limit(1)
      .get();
    return !!result;
  }

  // === 邀请相关 ===

  /**
   * 创建邀请
   */
  async createInvitation(data: InsertOrganizationInvitation): Promise<SelectOrganizationInvitation> {
    const db = getDb();
    return db.insert(organizationInvitations).values(data).returning().get();
  }

  /**
   * 查找用户收到的待处理邀请
   */
  async findPendingInvitationsByEmail(email: string): Promise<OrganizationInvitationWithUser[]> {
    const db = getDb();
    return db.select({
      id: organizationInvitations.id,
      organizationId: organizationInvitations.organizationId,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      invitedBy: organizationInvitations.invitedBy,
      status: organizationInvitations.status,
      createdAt: organizationInvitations.createdAt,
      organizationName: organizations.name,
      invitedByName: users.name,
    })
      .from(organizationInvitations)
      .innerJoin(
        organizations,
        eq(organizationInvitations.organizationId, organizations.id)
      )
      .leftJoin(
        users,
        eq(organizationInvitations.invitedBy, users.id)
      )
      .where(and(
        eq(organizationInvitations.email, email.toLowerCase()),
        eq(organizationInvitations.status, 'pending')
      ));
  }

  /**
   * 查找组织的待处理邀请
   */
  async findPendingInvitationsByOrg(orgId: number): Promise<OrganizationInvitationWithUser[]> {
    const db = getDb();
    return db.select({
      id: organizationInvitations.id,
      organizationId: organizationInvitations.organizationId,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      invitedBy: organizationInvitations.invitedBy,
      status: organizationInvitations.status,
      createdAt: organizationInvitations.createdAt,
      organizationName: organizations.name,
      invitedByName: users.name,
    })
      .from(organizationInvitations)
      .leftJoin(
        users,
        eq(organizationInvitations.invitedBy, users.id)
      )
      .where(and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.status, 'pending')
      ));
  }

  /**
   * 查找特定邀请
   */
  async findInvitation(invId: number): Promise<SelectOrganizationInvitation | undefined> {
    const db = getDb();
    return db.select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.id, invId))
      .get();
  }

  /**
   * 查找特定邀请（带邮箱和状态验证）
   */
  async findPendingInvitation(invId: number, email: string): Promise<SelectOrganizationInvitation | undefined> {
    const db = getDb();
    return db.select()
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.id, invId),
        eq(organizationInvitations.email, email.toLowerCase()),
        eq(organizationInvitations.status, 'pending')
      ))
      .get();
  }

  /**
   * 检查是否已有待处理邀请
   */
  async hasPendingInvitation(orgId: number, email: string): Promise<boolean> {
    const db = getDb();
    const result = db.select()
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.email, email.toLowerCase()),
        eq(organizationInvitations.status, 'pending')
      ))
      .limit(1)
      .get();
    return !!result;
  }

  /**
   * 更新邀请状态
   */
  async updateInvitationStatus(invId: number, status: 'accepted' | 'declined'): Promise<void> {
    const db = getDb();
    db.update(organizationInvitations)
      .set({ status })
      .where(eq(organizationInvitations.id, invId))
      .run();
  }

  /**
   * 删除邀请
   */
  async deleteInvitation(invId: number, orgId: number): Promise<void> {
    const db = getDb();
    db.delete(organizationInvitations)
      .where(and(
        eq(organizationInvitations.id, invId),
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.status, 'pending')
      ))
      .run();
  }

  /**
   * 创建组织并添加创建者为 owner（事务）
   */
  async createWithOwner(name: string, userId: number): Promise<SelectOrganization> {
    const sqliteDb = getSqliteDb();
    const db = getDb();

    // 使用事务
    const result = sqliteDb.transaction(() => {
      // 创建组织
      const org = db.insert(organizations)
        .values({ name, createdBy: userId })
        .returning()
        .get();

      // 添加创建者为 owner
      db.insert(organizationMembers)
        .values({
          organizationId: org.id,
          userId,
          role: 'owner',
          invitedBy: userId,
        })
        .run();

      return org;
    })();

    return result;
  }

  /**
   * 统计组织下的项目数量
   */
  async countProjects(orgId: number): Promise<number> {
    const sqliteDb = getSqliteDb();
    const result = sqliteDb.prepare(
      'SELECT COUNT(*) as count FROM projects WHERE organization_id = ?'
    ).get(orgId) as { count: number };
    return result.count;
  }
}
```

- [ ] **Step 2: 更新 Repositories 导出**

```typescript
// packages/server/src/repositories/index.ts
export { UserRepository } from './user.repository.js';
export { OrganizationRepository } from './organization.repository.js';
export type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
} from './organization.repository.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 2: 创建 Organization Service

**Files:**
- Create: `packages/server/src/services/organization.service.ts`
- Modify: `packages/server/src/services/index.ts`

- [ ] **Step 1: 创建 Organization Service**

```typescript
// packages/server/src/services/organization.service.ts
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
```

- [ ] **Step 2: 更新 Services 导出**

```typescript
// packages/server/src/services/index.ts
export { AuthService } from './auth.service.js';
export type { RegisterInput, LoginInput, AuthResult } from './auth.service.js';

export { OrganizationService } from './organization.service.js';
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  OrganizationDetail,
} from './organization.service.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 3: 重构 Organizations Routes

**Files:**
- Modify: `packages/server/src/routes/organizations.ts`

- [ ] **Step 1: 重构 Organizations Routes**

```typescript
// packages/server/src/routes/organizations.ts
import { Router } from 'express';
import { OrganizationService } from '../services/organization.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('organizations');

export function createOrganizationsRouter(): Router {
  const router = Router();
  const orgService = new OrganizationService();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // POST /api/organizations - 创建组织
  router.post('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const org = await orgService.create(userId, req.body);
      res.status(201).json(org);
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('名称')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('创建组织失败', error);
        res.status(500).json({ error: '创建组织失败' });
      }
    }
  });

  // GET /api/organizations - 获取用户所属的组织列表
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const organizations = await orgService.findByUserId(userId);
      res.json(organizations);
    } catch (error: any) {
      logger.error('获取组织列表失败', error);
      res.status(500).json({ error: '获取组织列表失败' });
    }
  });

  // GET /api/organizations/:id - 获取组织详情
  router.get('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      const org = await orgService.findById(orgId, userId);
      res.json(org);
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取组织详情失败', error);
        res.status(500).json({ error: '获取组织详情失败' });
      }
    }
  });

  // PUT /api/organizations/:id - 修改组织名称
  router.put('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      const org = await orgService.updateName(orgId, userId, req.body);
      res.json(org);
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('名称')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('修改组织名称失败', error);
        res.status(500).json({ error: '修改组织名称失败' });
      }
    }
  });

  // DELETE /api/organizations/:id - 删除组织
  router.delete('/:id', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      await orgService.delete(orgId, userId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('项目')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('删除组织失败', error);
        res.status(500).json({ error: '删除组织失败' });
      }
    }
  });

  // PUT /api/organizations/:id/members/:userId - 修改成员角色
  router.put('/:id/members/:userId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const targetUserId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

    if (isNaN(orgId) || isNaN(targetUserId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    try {
      const member = await orgService.updateMemberRole(orgId, userId, {
        userId: targetUserId,
        role: req.body.role,
      });
      res.json(member);
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('角色')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('最后一个')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在') || error.message.includes('不是')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('修改成员角色失败', error);
        res.status(500).json({ error: '修改成员角色失败' });
      }
    }
  });

  // DELETE /api/organizations/:id/members/:userId - 移除成员
  router.delete('/:id/members/:userId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const targetUserId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

    if (isNaN(orgId) || isNaN(targetUserId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    try {
      await orgService.removeMember(orgId, userId, targetUserId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('自己') || error.message.includes('最后一个')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('不存在') || error.message.includes('不是')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('移除成员失败', error);
        res.status(500).json({ error: '移除成员失败' });
      }
    }
  });

  // POST /api/organizations/:id/invitations - 邀请成员
  router.post('/:id/invitations', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      const invitation = await orgService.inviteMember(orgId, userId, req.body);
      res.status(201).json(invitation);
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('邮箱') || error.message.includes('角色')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('已是') || error.message.includes('已有')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('邀请成员失败', error);
        res.status(500).json({ error: '邀请成员失败' });
      }
    }
  });

  // GET /api/organizations/:id/invitations - 获取待处理邀请列表
  router.get('/:id/invitations', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      const invitations = await orgService.findPendingInvitations(orgId, userId);
      res.json(invitations);
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('获取邀请列表失败', error);
        res.status(500).json({ error: '获取邀请列表失败' });
      }
    }
  });

  // DELETE /api/organizations/:id/invitations/:invId - 取消邀请
  router.delete('/:id/invitations/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const invId = parseInt(Array.isArray(req.params.invId) ? req.params.invId[0] : req.params.invId, 10);

    if (isNaN(orgId) || isNaN(invId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    try {
      await orgService.cancelInvitation(orgId, userId, invId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('取消邀请失败', error);
        res.status(500).json({ error: '取消邀请失败' });
      }
    }
  });

  return router;
}
```

---

### Task 4: 重构 Invitations Routes

**Files:**
- Modify: `packages/server/src/routes/invitations.ts`

- [ ] **Step 1: 重构 Invitations Routes**

```typescript
// packages/server/src/routes/invitations.ts
import { Router } from 'express';
import { OrganizationService } from '../services/organization.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('invitations');

export function createInvitationsRouter(): Router {
  const router = Router();
  const orgService = new OrganizationService();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // GET /api/invitations - 获取用户收到的邀请
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;
    try {
      const invitations = await orgService.findUserInvitations(userId);
      res.json(invitations);
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取邀请列表失败', error);
        res.status(500).json({ error: '获取邀请列表失败' });
      }
    }
  });

  // POST /api/invitations/:invId - 接受邀请
  router.post('/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(Array.isArray(req.params.invId) ? req.params.invId[0] : req.params.invId, 10);

    if (isNaN(invId)) {
      res.status(400).json({ error: '无效的邀请 ID' });
      return;
    }

    try {
      const result = await orgService.acceptInvitation(userId, invId);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('不存在') || error.message.includes('已处理')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('接受邀请失败', error);
        res.status(500).json({ error: '接受邀请失败' });
      }
    }
  });

  // DELETE /api/invitations/:invId - 拒绝邀请
  router.delete('/:invId', async (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(Array.isArray(req.params.invId) ? req.params.invId[0] : req.params.invId, 10);

    if (isNaN(invId)) {
      res.status(400).json({ error: '无效的邀请 ID' });
      return;
    }

    try {
      await orgService.declineInvitation(userId, invId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('不存在') || error.message.includes('已处理')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('拒绝邀请失败', error);
        res.status(500).json({ error: '拒绝邀请失败' });
      }
    }
  });

  return router;
}
```

---

### Task 5: 更新主入口文件

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 更新路由注册**

修改 `packages/server/src/index.ts`：

```typescript
// 修改前
app.use('/api/organizations', createOrganizationsRouter(db));
app.use('/api/invitations', createInvitationsRouter(db));

// 修改后
app.use('/api/organizations', createOrganizationsRouter());
app.use('/api/invitations', createInvitationsRouter());
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 6: 验证功能

**Files:**
- Modify: 无需修改文件

- [ ] **Step 1: 运行现有测试**

```bash
cd packages/server && npm test
```

Expected: 测试通过或无测试文件

- [ ] **Step 2: 启动服务器验证**

```bash
cd packages/server && npm run dev
```

Expected: 服务器启动成功，无错误

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/repositories/ packages/server/src/services/ packages/server/src/routes/organizations.ts packages/server/src/routes/invitations.ts packages/server/src/index.ts
git commit -m "$(cat <<'EOF'
feat(server): refactor organization module with Drizzle ORM

- Add OrganizationRepository for data access
- Add OrganizationService for business logic
- Refactor organization and invitations routes
- Remove db parameter from routers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成标准

1. OrganizationRepository 已创建并通过编译
2. OrganizationService 已创建并通过编译
3. Organizations Routes 已重构
4. Invitations Routes 已重构
5. 主入口文件已更新
6. 服务器能正常启动
7. 提交已创建

## 后续阶段

完成此阶段后，进入 Phase 4: Project 模块重构。