import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const userClaudeConfigs = sqliteTable('user_claude_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }).unique(),
  config: text('config').notNull(),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});

export type InsertUserClaudeConfig = typeof userClaudeConfigs.$inferInsert;
export type SelectUserClaudeConfig = typeof userClaudeConfigs.$inferSelect;
