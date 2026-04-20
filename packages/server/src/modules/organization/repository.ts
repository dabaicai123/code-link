import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, and, sql } from 'drizzle-orm';
import { organizations, organizationMembers, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../db/connection.js';
import type { SelectOrganization, OrgRole } from '../../db/schema/index.js';
import type { OrganizationWithRole, OrganizationMemberWithUser } from './types.js';

@singleton()
export class OrganizationRepository extends BaseRepository {
  constructor(@inject(DatabaseConnection) db: DatabaseConnection) {
    super(db);
  }

  async createWithOwner(name: string, userId: number): Promise<SelectOrganization> {
    const org = await this.db.insert(organizations).values({
      name,
      createdBy: userId,
    }).returning().get();

    await this.db.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      role: 'owner',
      invitedBy: userId,
    }).run();

    return org;
  }

  async findById(id: number): Promise<SelectOrganization | undefined> {
    return this.db.select().from(organizations).where(eq(organizations.id, id)).get();
  }

  async findByUserId(userId: number): Promise<OrganizationWithRole[]> {
    const result = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        createdBy: organizations.createdBy,
        createdAt: organizations.createdAt,
        role: organizationMembers.role,
      })
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId))
      .all();

    return result.map(r => ({
      ...r,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));
  }

  async findMembers(orgId: number): Promise<OrganizationMemberWithUser[]> {
    const result = await this.db
      .select({
        userId: organizationMembers.userId,
        userName: users.name,
        userEmail: users.email,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId))
      .all();

    return result.map(r => ({
      ...r,
      joinedAt: r.joinedAt ?? new Date().toISOString(),
    }));
  }

  async findUserMembership(orgId: number, userId: number): Promise<{ role: OrgRole } | undefined> {
    const result = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .get();

    return result;
  }

  async updateName(orgId: number, name: string): Promise<SelectOrganization> {
    return this.db.update(organizations).set({ name }).where(eq(organizations.id, orgId)).returning().get();
  }

  async delete(orgId: number): Promise<void> {
    this.db.delete(organizations).where(eq(organizations.id, orgId)).run();
  }

  async updateMemberRole(orgId: number, userId: number, role: OrgRole): Promise<void> {
    this.db.update(organizationMembers)
      .set({ role })
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .run();
  }

  async removeMember(orgId: number, userId: number): Promise<void> {
    this.db.delete(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .run();
  }

  async isOwnerOfAny(userId: number): Promise<boolean> {
    const result = await this.db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, 'owner')
      ))
      .get();
    return !!result;
  }
}
