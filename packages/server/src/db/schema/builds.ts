import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';

export const builds = sqliteTable('builds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'running', 'success', 'failed'] })
    .notNull().default('pending'),
  previewPort: integer('preview_port'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  projectIdIdx: index('idx_builds_project_id').on(table.projectId),
}));

export type InsertBuild = typeof builds.$inferInsert;
export type SelectBuild = typeof builds.$inferSelect;
