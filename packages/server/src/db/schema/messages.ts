import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { projects } from './projects.js';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  type: text('type', { enum: ['chat', 'notification'] }).notNull().default('chat'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
