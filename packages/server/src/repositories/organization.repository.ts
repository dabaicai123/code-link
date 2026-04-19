import "reflect-metadata";
import { singleton } from "tsyringe";
import { eq, and, sql } from 'drizzle-orm';
import { getDb, getSqliteDb } from '../db/index.js';
import {
  organizations,
  organizationMembers,
  organizationInvitations,
  users,
  projects,
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

@singleton()
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
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.role, 'owner')
      ))
      .get();
    return result?.count ?? 0;
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
    const db = getDb();
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .get();
    return result?.count ?? 0;
  }

  /**
   * 在事务中接受邀请（更新邀请状态 + 添加成员 + 获取组织和成员信息）
   */
  acceptInvitationInTransaction(
    invId: number,
    organizationId: number,
    userId: number,
    role: string,
    invitedBy: number
  ): { organization: SelectOrganization; member: OrganizationMemberWithUser } {
    const sqliteDb = getSqliteDb();
    const db = getDb();

    return sqliteDb.transaction(() => {
      // 检查用户是否已是成员
      const existingMember = db.select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (existingMember) {
        throw new Error('用户已是该组织成员');
      }

      // 更新邀请状态
      db.update(organizationInvitations)
        .set({ status: 'accepted' })
        .where(eq(organizationInvitations.id, invId))
        .run();

      // 添加成员
      db.insert(organizationMembers)
        .values({
          organizationId,
          userId,
          role: role as 'owner' | 'developer' | 'member',
          invitedBy,
        })
        .run();

      // 获取组织信息
      const org = db.select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .get();

      if (!org) {
        throw new Error('组织不存在');
      }

      // 获取成员信息（带用户名）
      const member = db.select({
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
        .where(and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!member) {
        throw new Error('成员添加失败');
      }

      return { organization: org, member: member as OrganizationMemberWithUser };
    })();
  }
}