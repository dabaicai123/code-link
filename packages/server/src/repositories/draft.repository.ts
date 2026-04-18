import { eq, and, sql } from 'drizzle-orm';
import { getDb, getSqliteDb } from '../db/index.js';
import {
  drafts,
  draftMembers,
  draftMessages,
  messageConfirmations,
  users,
} from '../db/schema/index.js';
import type {
  InsertDraft,
  SelectDraft,
  InsertDraftMember,
  SelectDraftMember,
  InsertDraftMessage,
  SelectDraftMessage,
  InsertMessageConfirmation,
  SelectMessageConfirmation,
} from '../db/schema/index.js';

export interface DraftMemberWithUser extends SelectDraftMember {
  userName: string;
}

export interface DraftMessageWithUser extends SelectDraftMessage {
  userName: string | null;
}

export class DraftRepository {
  async findById(draftId: number): Promise<SelectDraft | undefined> {
    const db = getDb();
    return db.select().from(drafts).where(eq(drafts.id, draftId)).get();
  }

  async create(data: InsertDraft): Promise<SelectDraft> {
    const db = getDb();
    return db.insert(drafts).values(data).returning().get();
  }

  async updateStatus(draftId: number, status: string): Promise<SelectDraft> {
    const db = getDb();
    return db.update(drafts)
      .set({ status: status as 'discussing' | 'brainstorming' | 'reviewing' | 'developing' | 'confirmed' | 'archived', updatedAt: sql`datetime('now')` })
      .where(eq(drafts.id, draftId))
      .returning()
      .get();
  }

  async touch(draftId: number): Promise<void> {
    const db = getDb();
    db.update(drafts)
      .set({ updatedAt: sql`datetime('now')` })
      .where(eq(drafts.id, draftId))
      .run();
  }

  async delete(draftId: number): Promise<void> {
    const db = getDb();
    db.delete(drafts).where(eq(drafts.id, draftId)).run();
  }

  async findByUserId(userId: number): Promise<SelectDraft[]> {
    const db = getDb();
    return db.select({
      id: drafts.id,
      projectId: drafts.projectId,
      title: drafts.title,
      status: drafts.status,
      createdBy: drafts.createdBy,
      createdAt: drafts.createdAt,
      updatedAt: drafts.updatedAt,
    })
      .from(drafts)
      .innerJoin(draftMembers, eq(drafts.id, draftMembers.draftId))
      .where(eq(draftMembers.userId, userId));
  }

  async findMember(draftId: number, userId: number): Promise<SelectDraftMember | undefined> {
    const db = getDb();
    return db.select()
      .from(draftMembers)
      .where(and(
        eq(draftMembers.draftId, draftId),
        eq(draftMembers.userId, userId)
      ))
      .get();
  }

  async findMembers(draftId: number): Promise<DraftMemberWithUser[]> {
    const db = getDb();
    const result = db.select({
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
    return result as DraftMemberWithUser[];
  }

  async addMember(data: InsertDraftMember): Promise<SelectDraftMember> {
    const db = getDb();
    return db.insert(draftMembers).values(data).returning().get();
  }

  async removeMember(draftId: number, userId: number): Promise<void> {
    const db = getDb();
    db.delete(draftMembers)
      .where(and(
        eq(draftMembers.draftId, draftId),
        eq(draftMembers.userId, userId)
      ))
      .run();
  }

  async createWithOwner(data: InsertDraft, userId: number): Promise<SelectDraft> {
    const sqliteDb = getSqliteDb();
    const db = getDb();

    const result = sqliteDb.transaction(() => {
      const draft = db.insert(drafts).values(data).returning().get();
      db.insert(draftMembers).values({
        draftId: draft.id,
        userId,
        role: 'owner',
      }).run();
      return draft;
    })();

    return result;
  }

  async createMessage(data: InsertDraftMessage): Promise<SelectDraftMessage> {
    const db = getDb();
    return db.insert(draftMessages).values(data).returning().get();
  }

  async findMessage(messageId: number, draftId: number): Promise<SelectDraftMessage | undefined> {
    const db = getDb();
    return db.select()
      .from(draftMessages)
      .where(and(
        eq(draftMessages.id, messageId),
        eq(draftMessages.draftId, draftId)
      ))
      .get();
  }

  async findMessages(
    draftId: number,
    options: { parentId?: number | null; before?: string; limit?: number } = {}
  ): Promise<DraftMessageWithUser[]> {
    const db = getDb();
    const limit = options.limit || 50;

    // 简化查询，直接获取所有消息
    const result = db.select({
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
      .leftJoin(users, eq(draftMessages.userId, users.id))
      .where(eq(draftMessages.draftId, draftId))
      .limit(limit)
      .all();

    return result as DraftMessageWithUser[];
  }

  async upsertConfirmation(data: InsertMessageConfirmation): Promise<SelectMessageConfirmation> {
    const sqliteDb = getSqliteDb();
    sqliteDb.prepare(
      `INSERT INTO message_confirmations (message_id, user_id, type, comment)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id, user_id) DO UPDATE SET
         type = excluded.type,
         comment = excluded.comment,
         created_at = datetime('now')`
    ).run(data.messageId, data.userId, data.type, data.comment || null);

    const db = getDb();
    return db.select()
      .from(messageConfirmations)
      .where(and(
        eq(messageConfirmations.messageId, data.messageId),
        eq(messageConfirmations.userId, data.userId)
      ))
      .get()!;
  }

  async findConfirmations(messageId: number): Promise<Array<SelectMessageConfirmation & { userName: string }>> {
    const db = getDb();
    const result = db.select({
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
    return result as Array<SelectMessageConfirmation & { userName: string }>;
  }
}