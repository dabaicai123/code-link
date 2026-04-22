import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const projectTokens = sqliteTable('project_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'gitlab'] }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  userProviderUnique: unique().on(table.userId, table.provider),
  userIdIdx: index('idx_tokens_user_id').on(table.userId),
}));

export type InsertProjectToken = typeof projectTokens.$inferInsert;
export type SelectProjectToken = typeof projectTokens.$inferSelect;
