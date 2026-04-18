import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  templateType: text('template_type', { enum: ['node', 'node+java', 'node+python'] }).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id),
  containerId: text('container_id'),
  status: text('status', { enum: ['created', 'running', 'stopped'] }).notNull().default('created'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'product'] }).notNull(),
});

export type InsertProject = typeof projects.$inferInsert;
export type SelectProject = typeof projects.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;
export type SelectProjectMember = typeof projectMembers.$inferSelect;
