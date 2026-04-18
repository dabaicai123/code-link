import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export const organizationMembers = sqliteTable('organization_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'developer', 'member'] }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  joinedAt: text('joined_at').notNull().default(sql`datetime('now')`),
});

export const organizationInvitations = sqliteTable('organization_invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['owner', 'developer', 'member'] }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'accepted', 'declined'] })
    .notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertOrganization = typeof organizations.$inferInsert;
export type SelectOrganization = typeof organizations.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type SelectOrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationInvitation = typeof organizationInvitations.$inferInsert;
export type SelectOrganizationInvitation = typeof organizationInvitations.$inferSelect;
