import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';

export const projectRepos = sqliteTable('project_repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'gitlab'] }).notNull(),
  repoUrl: text('repo_url').notNull(),
  repoName: text('repo_name').notNull(),
  branch: text('branch').notNull().default('main'),
  cloned: integer('cloned', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});

export type InsertProjectRepo = typeof projectRepos.$inferInsert;
export type SelectProjectRepo = typeof projectRepos.$inferSelect;
