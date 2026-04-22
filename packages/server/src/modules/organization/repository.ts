import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, and, sql } from 'drizzle-orm';
import { organizations, organizationMembers, users, organizationInvitations } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../db/connection.js';
import { PAGINATION_LIMITS } from '../../core/database/constants.js';
import { computeOffset, computeTotalPages, type PaginatedResult } from '../../core/database/pagination.js';
import type { SelectOrganization, SelectOrganizationInvitation, OrgRole } from '../../db/schema/index.js';
import type { OrganizationWithRole, OrganizationMemberWithUser, OrganizationInvitationWithUser } from './types.js';

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

  async findByUserId(userId: number, page?: number, limit?: number): Promise<PaginatedResult<OrganizationWithRole>> {
    const effectiveLimit = limit !== undefined
      ? Math.min(limit, PAGINATION_LIMITS.organizations.max)
      : PAGINATION_LIMITS.organizations.default;
    const effectivePage = page ?? 1;
    const offset = computeOffset(effectivePage, effectiveLimit);

    // Total count
    const countResult = this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId))
      .get();
    const total = countResult?.count ?? 0;

    // Paginated data
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
      .limit(effectiveLimit)
      .offset(offset)
      .all();

    const data = result.map(r => ({
      ...r,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));

    return {
      data,
      meta: {
        page: effectivePage,
        limit: effectiveLimit,
        total,
        totalPages: computeTotalPages(total, effectiveLimit),
      },
    };
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
      .select({ exists: sql`1` })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, 'owner')
      ))
      .limit(1)
      .get();
    return result !== undefined;
  }

  // === Invitation Methods ===

  async createInvitation(orgId: number, email: string, role: OrgRole, invitedBy: number): Promise<SelectOrganizationInvitation> {
    return this.db.insert(organizationInvitations).values({
      organizationId: orgId,
      email,
      role,
      invitedBy,
      status: 'pending',
    }).returning().get();
  }

  async findInvitationsByOrgId(orgId: number): Promise<OrganizationInvitationWithUser[]> {
    const inviter = this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .as('inviter');

    const result = await this.db
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        invitedBy: organizationInvitations.invitedBy,
        invitedByName: inviter.name,
        createdAt: organizationInvitations.createdAt,
        status: organizationInvitations.status,
      })
      .from(organizationInvitations)
      .innerJoin(inviter, eq(organizationInvitations.invitedBy, inviter.id))
      .where(and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.status, 'pending')
      ))
      .all();

    return result.map(r => ({
      ...r,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));
  }

  async findPendingInvitationsForEmail(email: string): Promise<OrganizationInvitationWithUser[]> {
    const inviter = this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .as('inviter');

    const orgName = this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .as('org');

    const result = await this.db
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        organizationName: orgName.name,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        invitedBy: organizationInvitations.invitedBy,
        invitedByName: inviter.name,
        createdAt: organizationInvitations.createdAt,
        status: organizationInvitations.status,
      })
      .from(organizationInvitations)
      .innerJoin(inviter, eq(organizationInvitations.invitedBy, inviter.id))
      .innerJoin(orgName, eq(organizationInvitations.organizationId, orgName.id))
      .where(and(
        eq(organizationInvitations.email, email),
        eq(organizationInvitations.status, 'pending')
      ))
      .all();

    return result.map(r => ({
      ...r,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));
  }

  async findInvitationById(invId: number): Promise<SelectOrganizationInvitation | undefined> {
    return this.db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invId)).get();
  }

  async acceptInvitation(invId: number, userId: number): Promise<void> {
    const inv = await this.findInvitationById(invId);
    if (!inv) throw new Error('Invitation not found');

    this.db.update(organizationInvitations)
      .set({ status: 'accepted' })
      .where(eq(organizationInvitations.id, invId))
      .run();

    await this.db.insert(organizationMembers).values({
      organizationId: inv.organizationId,
      userId,
      role: inv.role,
      invitedBy: inv.invitedBy,
    }).run();
  }

  async declineInvitation(invId: number): Promise<void> {
    this.db.update(organizationInvitations)
      .set({ status: 'declined' })
      .where(eq(organizationInvitations.id, invId))
      .run();
  }

  async cancelInvitation(invId: number): Promise<void> {
    this.db.delete(organizationInvitations)
      .where(eq(organizationInvitations.id, invId))
      .run();
  }

  async hasPendingInvitation(orgId: number, email: string): Promise<boolean> {
    const result = await this.db
      .select({ exists: sql`1` })
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.email, email),
        eq(organizationInvitations.status, 'pending')
      ))
      .limit(1)
      .get();
    return result !== undefined;
  }
}
