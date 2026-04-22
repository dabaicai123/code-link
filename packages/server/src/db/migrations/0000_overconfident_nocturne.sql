CREATE TABLE `builds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`preview_port` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_builds_project_id` ON `builds` (`project_id`);--> statement-breakpoint
CREATE TABLE `draft_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'participant' NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_draft_members_draft_id` ON `draft_members` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_draft_members_user_id` ON `draft_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `draft_members_draft_id_user_id_unique` ON `draft_members` (`draft_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `draft_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`parent_id` integer,
	`user_id` integer NOT NULL,
	`content` text,
	`message_type` text DEFAULT 'text' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `draft_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_draft_messages_draft_id` ON `draft_messages` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_draft_messages_parent_id` ON `draft_messages` (`parent_id`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'discussing' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_project_id` ON `drafts` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_drafts_status` ON `drafts` (`status`);--> statement-breakpoint
CREATE TABLE `message_confirmations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`type` text DEFAULT 'agree' NOT NULL,
	`comment` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `draft_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_message_confirmations_message_id` ON `message_confirmations` (`message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `message_confirmations_message_id_user_id_unique` ON `message_confirmations` (`message_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_org_invitations_org_id` ON `organization_invitations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_org_invitations_email` ON `organization_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_org_invitations_status` ON `organization_invitations` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invitations_organization_id_email_unique` ON `organization_invitations` (`organization_id`,`email`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`invited_by` integer NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_org_members_org_id` ON `organization_members` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_org_members_user_id` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_members_organization_id_user_id_unique` ON `organization_members` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`provider` text NOT NULL,
	`repo_url` text NOT NULL,
	`repo_name` text NOT NULL,
	`branch` text DEFAULT 'main' NOT NULL,
	`cloned` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_repos_project_id` ON `project_repos` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_repos_project_id_repo_url_unique` ON `project_repos` (`project_id`,`repo_url`);--> statement-breakpoint
CREATE TABLE `project_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tokens_user_id` ON `project_tokens` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_tokens_user_id_provider_unique` ON `project_tokens` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`template_type` text NOT NULL,
	`organization_id` integer NOT NULL,
	`container_id` text,
	`status` text DEFAULT 'created' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_projects_organization_id` ON `projects` (`organization_id`);--> statement-breakpoint
CREATE TABLE `user_claude_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`config` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_claude_configs_user_id_unique` ON `user_claude_configs` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);