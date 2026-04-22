import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  templateType: text('template_type', { enum: ['node', 'node+java', 'node+python'] }).notNull(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  containerId: text('container_id'),
  status: text('status', { enum: ['created', 'running', 'stopped'] }).notNull().default('created'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  organizationIdIdx: index('idx_projects_organization_id').on(table.organizationId),
}));

export type InsertProject = typeof projects.$inferInsert;
export type SelectProject = typeof projects.$inferSelect;
