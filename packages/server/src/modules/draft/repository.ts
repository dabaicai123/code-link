import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  drafts,
  draftMembers,
  draftMessages,
  messageConfirmations,
  users,
  projects,
} from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../core/database/connection.js';
import type {
  InsertDraft,
  SelectDraft,
  InsertDraftMember,
  SelectDraftMember,
  InsertDraftMessage,
  SelectDraftMessage,
  InsertMessageConfirmation,
  SelectMessageConfirmation,
} from '../../db/schema/index.js';
import type { DraftContext, DraftMemberWithUser, DraftMessageWithUser, MessageConfirmationWithUser } from './types.js';

@singleton()
export class DraftRepository extends BaseRepository {
  constructor(@inject(DatabaseConnection) db: DatabaseConnection) {
    super(db);
  }

  // ==================== Draft Operations ====================

  async create(data: InsertDraft): Promise<SelectDraft> {
    return this.db.insert(drafts).values(data).returning().get();
  }

  async findById(id: number): Promise<SelectDraft | undefined> {
    return this.db.select().from(drafts).where(eq(drafts.id, id)).get();
  }

  async findByUserId(userId: number): Promise<SelectDraft[]> {
    // Find drafts where user is a member or creator
    return this.db
      .selectDistinct({ drafts })
      .from(drafts)
      .leftJoin(draftMembers, eq(drafts.id, draftMembers.draftId))
      .where(
        sql`${drafts.createdBy} = ${userId} OR ${draftMembers.userId} = ${userId}`
      )
      .all()
      .map(row => row.drafts);
  }

  async updateStatus(id: number, status: string): Promise<SelectDraft> {
    return this.db
      .update(drafts)
      .set({ status, updatedAt: sql`datetime('now')` })
      .where(eq(drafts.id, id))
      .returning()
      .get();
  }

  async touch(id: number): Promise<void> {
    this.db
      .update(drafts)
      .set({ updatedAt: sql`datetime('now')` })
      .where(eq(drafts.id, id))
      .run();
  }

  async delete(id: number): Promise<void> {
    this.db.delete(drafts).where(eq(drafts.id, id)).run();
  }

  async createWithOwner(data: InsertDraft, ownerId: number): Promise<SelectDraft> {
    return this.transaction(() => {
      const draft = this.db.insert(drafts).values(data).returning().get();
      this.db
        .insert(draftMembers)
        .values({
          draftId: draft.id,
          userId: ownerId,
          role: 'owner',
        })
        .run();
      return draft;
    });
  }

  // ==================== Member Operations ====================

  async findMember(draftId: number, userId: number): Promise<SelectDraftMember | undefined> {
    return this.db
      .select()
      .from(draftMembers)
      .where(and(eq(draftMembers.draftId, draftId), eq(draftMembers.userId, userId)))
      .get();
  }

  async findMembers(draftId: number): Promise<DraftMemberWithUser[]> {
    return this.db
      .select({
        id: draftMembers.id,
        draftId: draftMembers.draftId,
        userId: draftMembers.userId,
        role: draftMembers.role,
        joinedAt: draftMembers.joinedAt,
        userName: users.name,
      })
      .from(draftMembers)
      .innerJoin(users, eq(draftMembers.userId, users.id))
      .where(eq(draftMembers.draftId, draftId))
      .all();
  }

  async addMember(
    draftId: number,
    userId: number,
    role: 'owner' | 'participant' = 'participant'
  ): Promise<SelectDraftMember> {
    return this.db
      .insert(draftMembers)
      .values({ draftId, userId, role })
      .returning()
      .get();
  }

  async removeMember(draftId: number, userId: number): Promise<void> {
    this.db
      .delete(draftMembers)
      .where(and(eq(draftMembers.draftId, draftId), eq(draftMembers.userId, userId)))
      .run();
  }

  // ==================== Message Operations ====================

  async createMessage(data: InsertDraftMessage): Promise<SelectDraftMessage> {
    return this.db.insert(draftMessages).values(data).returning().get();
  }

  async findMessage(draftId: number, messageId: number): Promise<SelectDraftMessage | undefined> {
    return this.db
      .select()
      .from(draftMessages)
      .where(and(eq(draftMessages.draftId, draftId), eq(draftMessages.id, messageId)))
      .get();
  }

  async findMessages(draftId: number, limit?: number): Promise<DraftMessageWithUser[]> {
    let query = this.db
      .select({
        id: draftMessages.id,
        draftId: draftMessages.draftId,
        parentId: draftMessages.parentId,
        userId: draftMessages.userId,
        content: draftMessages.content,
        messageType: draftMessages.messageType,
        metadata: draftMessages.metadata,
        createdAt: draftMessages.createdAt,
        updatedAt: draftMessages.updatedAt,
        userName: users.name,
      })
      .from(draftMessages)
      .innerJoin(users, eq(draftMessages.userId, users.id))
      .where(eq(draftMessages.draftId, draftId))
      .orderBy(desc(draftMessages.createdAt));

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    return query.all();
  }

  // ==================== Confirmation Operations ====================

  async upsertConfirmation(data: InsertMessageConfirmation): Promise<SelectMessageConfirmation> {
    // SQLite doesn't support true upsert with ON CONFLICT DO UPDATE in Drizzle easily
    // Check if exists, then update or insert
    const existing = this.db
      .select()
      .from(messageConfirmations)
      .where(
        and(
          eq(messageConfirmations.messageId, data.messageId),
          eq(messageConfirmations.userId, data.userId)
        )
      )
      .get();

    if (existing) {
      return this.db
        .update(messageConfirmations)
        .set({
          type: data.type,
          comment: data.comment,
        })
        .where(eq(messageConfirmations.id, existing.id))
        .returning()
        .get();
    }

    return this.db.insert(messageConfirmations).values(data).returning().get();
  }

  async findConfirmations(messageId: number): Promise<MessageConfirmationWithUser[]> {
    return this.db
      .select({
        id: messageConfirmations.id,
        messageId: messageConfirmations.messageId,
        userId: messageConfirmations.userId,
        type: messageConfirmations.type,
        comment: messageConfirmations.comment,
        createdAt: messageConfirmations.createdAt,
        userName: users.name,
      })
      .from(messageConfirmations)
      .innerJoin(users, eq(messageConfirmations.userId, users.id))
      .where(eq(messageConfirmations.messageId, messageId))
      .all();
  }

  // ==================== Draft Context ====================

  async findDraftContext(draftId: number): Promise<DraftContext | undefined> {
    const draft = this.db
      .select({
        id: drafts.id,
        projectId: drafts.projectId,
        title: drafts.title,
        status: drafts.status,
        createdBy: drafts.createdBy,
        createdAt: drafts.createdAt,
        updatedAt: drafts.updatedAt,
        projectName: projects.name,
        projectTemplate: projects.templateType,
        containerId: projects.containerId,
      })
      .from(drafts)
      .innerJoin(projects, eq(drafts.projectId, projects.id))
      .where(eq(drafts.id, draftId))
      .get();

    if (!draft) return undefined;

    const members = this.db
      .select({
        userId: draftMembers.userId,
        userName: users.name,
        role: draftMembers.role,
      })
      .from(draftMembers)
      .innerJoin(users, eq(draftMembers.userId, users.id))
      .where(eq(draftMembers.draftId, draftId))
      .all();

    const recentMessages = this.db
      .select({
        userId: draftMessages.userId,
        userName: users.name,
        content: draftMessages.content,
        messageType: draftMessages.messageType,
        createdAt: draftMessages.createdAt,
      })
      .from(draftMessages)
      .innerJoin(users, eq(draftMessages.userId, users.id))
      .where(eq(draftMessages.draftId, draftId))
      .orderBy(desc(draftMessages.createdAt))
      .limit(10)
      .all();

    return {
      draft: {
        id: draft.id,
        projectId: draft.projectId,
        title: draft.title,
        status: draft.status,
        createdBy: draft.createdBy,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        projectName: draft.projectName,
        projectTemplate: draft.projectTemplate,
        containerId: draft.containerId,
      },
      members,
      recentMessages,
    };
  }
}