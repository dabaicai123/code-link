import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { projects } from './projects.js';

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status', {
    enum: ['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived']
  }).notNull().default('discussing'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  projectIdIdx: index('idx_drafts_project_id').on(table.projectId),
  statusIdx: index('idx_drafts_status').on(table.status),
}));

export const draftMembers = sqliteTable('draft_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'participant'] }).notNull().default('participant'),
  joinedAt: text('joined_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  draftUserUnique: unique().on(table.draftId, table.userId),
  draftIdIdx: index('idx_draft_members_draft_id').on(table.draftId),
  userIdIdx: index('idx_draft_members_user_id').on(table.userId),
}));

export const draftMessages = sqliteTable('draft_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references(() => draftMessages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content'),
  messageType: text('message_type', {
    enum: ['text', 'image', 'code', 'document_card', 'ai_command', 'system', 'ai_response', 'ai_error']
  }).notNull().default('text'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  draftIdIdx: index('idx_draft_messages_draft_id').on(table.draftId),
  parentIdIdx: index('idx_draft_messages_parent_id').on(table.parentId),
}));

export const messageConfirmations = sqliteTable('message_confirmations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: integer('message_id').notNull()
    .references(() => draftMessages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['agree', 'disagree', 'suggest'] }).notNull().default('agree'),
  comment: text('comment'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  messageUserUnique: unique().on(table.messageId, table.userId),
  messageIdIdx: index('idx_message_confirmations_message_id').on(table.messageId),
}));

export type InsertDraft = typeof drafts.$inferInsert;
export type SelectDraft = typeof drafts.$inferSelect;
export type InsertDraftMember = typeof draftMembers.$inferInsert;
export type SelectDraftMember = typeof draftMembers.$inferSelect;
export type InsertDraftMessage = typeof draftMessages.$inferInsert;
export type SelectDraftMessage = typeof draftMessages.$inferSelect;
export type InsertMessageConfirmation = typeof messageConfirmations.$inferInsert;
export type SelectMessageConfirmation = typeof messageConfirmations.$inferSelect;
