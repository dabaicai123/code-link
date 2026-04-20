/**
 * Test helpers module for Drizzle ORM operations
 * Provides functions for creating, finding, updating, and deleting test data
 */

import "reflect-metadata";
import { eq, and } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { container } from 'tsyringe';
import { getDb, getSqliteDb, closeDb } from '../../src/db/index.js';
import { initSchema } from '../../src/db/schema.js';
import { DatabaseConnection } from '../../src/core/database/connection.js';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  drafts,
  draftMembers,
  draftMessages,
  messageConfirmations,
  projectTokens,
  projectRepos,
  userClaudeConfigs,
  builds,
} from '../../src/db/schema/index.js';
import type {
  InsertUser,
  SelectUser,
  InsertOrganization,
  SelectOrganization,
  InsertOrganizationMember,
  SelectOrganizationMember,
  InsertProject,
  SelectProject,
  InsertDraft,
  SelectDraft,
  InsertDraftMember,
  SelectDraftMember,
  InsertDraftMessage,
  SelectDraftMessage,
  InsertMessageConfirmation,
  SelectMessageConfirmation,
  InsertProjectToken,
  SelectProjectToken,
  InsertProjectRepo,
  SelectProjectRepo,
  InsertUserClaudeConfig,
  SelectUserClaudeConfig,
  InsertBuild,
  SelectBuild,
} from '../../src/db/schema/index.js';

// ============================================================================
// Database Setup Helpers
// ============================================================================

export function setupTestDb(): Database.Database {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);

  container.reset();
  container.register(DatabaseConnection, { useValue: DatabaseConnection.fromSqlite(db) });

  return db;
}

export function teardownTestDb(): void {
  container.reset();
  closeDb();
}

// ============================================================================
// User Helpers
// ============================================================================

export interface CreateTestUserOptions {
  name?: string;
  email?: string;
  passwordHash?: string;
  avatar?: string;
}

export function createTestUser(options: CreateTestUserOptions = {}): SelectUser {
  const db = getDb();
  const email = options.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const result = db
    .insert(users)
    .values({
      name: options.name || 'Test User',
      email,
      passwordHash: options.passwordHash || 'test-hash',
      avatar: options.avatar,
    })
    .returning()
    .get();
  return result;
}

export function findUserByEmail(email: string): SelectUser | undefined {
  const db = getDb();
  return db.select().from(users).where(eq(users.email, email)).get();
}

export function findUserById(id: number): SelectUser | undefined {
  const db = getDb();
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function deleteTestUser(id: number): void {
  const db = getDb();
  db.delete(users).where(eq(users.id, id)).run();
}

// ============================================================================
// Organization Helpers
// ============================================================================

export interface CreateTestOrganizationOptions {
  name?: string;
}

export function createTestOrganization(
  userId: number,
  options: CreateTestOrganizationOptions = {}
): SelectOrganization {
  const db = getDb();
  const result = db
    .insert(organizations)
    .values({
      name: options.name || `Test Organization ${Date.now()}`,
      createdBy: userId,
    })
    .returning()
    .get();
  return result;
}

export function findOrganizationById(id: number): SelectOrganization | undefined {
  const db = getDb();
  return db.select().from(organizations).where(eq(organizations.id, id)).get();
}

export function createTestOrganizationMember(
  orgId: number,
  userId: number,
  role: 'owner' | 'developer' | 'member' = 'member',
  invitedBy: number
): SelectOrganizationMember {
  const db = getDb();
  const result = db
    .insert(organizationMembers)
    .values({
      organizationId: orgId,
      userId,
      role,
      invitedBy,
    })
    .returning()
    .get();
  return result;
}

// ============================================================================
// Project Helpers
// ============================================================================

export interface CreateTestProjectOptions {
  name?: string;
  templateType?: 'node' | 'node+java' | 'node+python';
  containerId?: string;
  status?: 'created' | 'running' | 'stopped';
}

export function createTestProject(
  userId: number,
  orgId: number,
  options: CreateTestProjectOptions = {}
): SelectProject {
  const db = getDb();
  const result = db
    .insert(projects)
    .values({
      name: options.name || `Test Project ${Date.now()}`,
      templateType: options.templateType || 'node',
      organizationId: orgId,
      containerId: options.containerId,
      status: options.status || 'created',
      createdBy: userId,
    })
    .returning()
    .get();
  return result;
}

export function findProjectById(id: number): SelectProject | undefined {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function findProjectsByOrganizationId(orgId: number): SelectProject[] {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.organizationId, orgId)).all();
}

export function deleteTestProject(id: number): void {
  const db = getDb();
  db.delete(projects).where(eq(projects.id, id)).run();
}

export function updateTestProjectStatus(
  id: number,
  status: 'created' | 'running' | 'stopped',
  containerId?: string
): SelectProject | undefined {
  const db = getDb();
  const updateData: Partial<InsertProject> = { status };
  if (containerId !== undefined) {
    updateData.containerId = containerId;
  }
  return db.update(projects).set(updateData).where(eq(projects.id, id)).returning().get();
}

// ============================================================================
// Draft Helpers
// ============================================================================

export interface CreateTestDraftOptions {
  title?: string;
  status?: 'discussing' | 'brainstorming' | 'reviewing' | 'developing' | 'confirmed' | 'archived';
}

export function createTestDraft(
  userId: number,
  projectId: number,
  options: CreateTestDraftOptions = {}
): SelectDraft {
  const db = getDb();
  const result = db
    .insert(drafts)
    .values({
      projectId,
      title: options.title || `Test Draft ${Date.now()}`,
      status: options.status || 'discussing',
      createdBy: userId,
    })
    .returning()
    .get();
  return result;
}

export function findDraftById(id: number): SelectDraft | undefined {
  const db = getDb();
  return db.select().from(drafts).where(eq(drafts.id, id)).get();
}

export function deleteTestDraft(id: number): void {
  const db = getDb();
  db.delete(drafts).where(eq(drafts.id, id)).run();
}

export function updateTestDraftStatus(
  id: number,
  status: 'discussing' | 'brainstorming' | 'reviewing' | 'developing' | 'confirmed' | 'archived'
): SelectDraft | undefined {
  const db = getDb();
  return db.update(drafts).set({ status }).where(eq(drafts.id, id)).returning().get();
}

// ============================================================================
// Draft Member Helpers
// ============================================================================

export function createTestDraftMember(
  draftId: number,
  userId: number,
  role: 'owner' | 'participant' = 'participant'
): SelectDraftMember {
  const db = getDb();
  const result = db
    .insert(draftMembers)
    .values({
      draftId,
      userId,
      role,
    })
    .returning()
    .get();
  return result;
}

export function findDraftMembers(draftId: number): SelectDraftMember[] {
  const db = getDb();
  return db.select().from(draftMembers).where(eq(draftMembers.draftId, draftId)).all();
}

// ============================================================================
// Draft Message Helpers
// ============================================================================

export interface CreateTestDraftMessageOptions {
  parentId?: number;
  content?: string;
  messageType?: 'text' | 'image' | 'code' | 'document_card' | 'ai_command' | 'system' | 'ai_response' | 'ai_error';
  metadata?: string;
}

export function createTestDraftMessage(
  draftId: number,
  userId: number,
  options: CreateTestDraftMessageOptions = {}
): SelectDraftMessage {
  const db = getDb();
  const result = db
    .insert(draftMessages)
    .values({
      draftId,
      parentId: options.parentId,
      userId,
      content: options.content || 'Test message content',
      messageType: options.messageType || 'text',
      metadata: options.metadata,
    })
    .returning()
    .get();
  return result;
}

export function findDraftMessages(draftId: number): SelectDraftMessage[] {
  const db = getDb();
  return db.select().from(draftMessages).where(eq(draftMessages.draftId, draftId)).all();
}

// ============================================================================
// Message Confirmation Helpers
// ============================================================================

export function createTestMessageConfirmation(
  messageId: number,
  userId: number,
  type: 'agree' | 'disagree' | 'suggest' = 'agree',
  comment?: string
): SelectMessageConfirmation {
  const db = getDb();
  const result = db
    .insert(messageConfirmations)
    .values({
      messageId,
      userId,
      type,
      comment,
    })
    .returning()
    .get();
  return result;
}

export function findMessageConfirmations(messageId: number): SelectMessageConfirmation[] {
  const db = getDb();
  return db
    .select()
    .from(messageConfirmations)
    .where(eq(messageConfirmations.messageId, messageId))
    .all();
}

// ============================================================================
// Token Helpers
// ============================================================================

export interface CreateTestTokenOptions {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export function createTestToken(
  userId: number,
  provider: 'github' | 'gitlab',
  options: CreateTestTokenOptions = {}
): SelectProjectToken {
  const db = getDb();
  const result = db
    .insert(projectTokens)
    .values({
      userId,
      provider,
      accessToken: options.accessToken || 'test-access-token',
      refreshToken: options.refreshToken,
      expiresAt: options.expiresAt,
    })
    .returning()
    .get();
  return result;
}

export function findTokensByUserId(userId: number): SelectProjectToken[] {
  const db = getDb();
  return db.select().from(projectTokens).where(eq(projectTokens.userId, userId)).all();
}

export function findTokenByUserIdAndProvider(
  userId: number,
  provider: 'github' | 'gitlab'
): SelectProjectToken | undefined {
  const db = getDb();
  return db
    .select()
    .from(projectTokens)
    .where(and(eq(projectTokens.userId, userId), eq(projectTokens.provider, provider)))
    .get();
}

export function deleteTestToken(userId: number, provider: 'github' | 'gitlab'): void {
  const db = getDb();
  db.delete(projectTokens)
    .where(and(eq(projectTokens.userId, userId), eq(projectTokens.provider, provider)))
    .run();
}

// ============================================================================
// Repo Helpers
// ============================================================================

export interface CreateTestRepoOptions {
  provider?: 'github' | 'gitlab';
  repoUrl?: string;
  repoName?: string;
  branch?: string;
  cloned?: boolean;
}

export function createTestRepo(
  projectId: number,
  options: CreateTestRepoOptions = {}
): SelectProjectRepo {
  const db = getDb();
  const uniqueSuffix = `-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = db
    .insert(projectRepos)
    .values({
      projectId,
      provider: options.provider || 'github',
      repoUrl: options.repoUrl || `https://github.com/test/repo${uniqueSuffix}`,
      repoName: options.repoName || `test/repo${uniqueSuffix}`,
      branch: options.branch || 'main',
      cloned: options.cloned ?? false,
    })
    .returning()
    .get();
  return result;
}

export function findReposByProjectId(projectId: number): SelectProjectRepo[] {
  const db = getDb();
  return db.select().from(projectRepos).where(eq(projectRepos.projectId, projectId)).all();
}

export function findRepoById(id: number): SelectProjectRepo | undefined {
  const db = getDb();
  return db.select().from(projectRepos).where(eq(projectRepos.id, id)).get();
}

export function deleteTestRepo(id: number): void {
  const db = getDb();
  db.delete(projectRepos).where(eq(projectRepos.id, id)).run();
}

// ============================================================================
// Claude Config Helpers
// ============================================================================

export function createTestClaudeConfig(userId: number, config: string): SelectUserClaudeConfig {
  const db = getDb();
  const result = db
    .insert(userClaudeConfigs)
    .values({
      userId,
      config,
    })
    .returning()
    .get();
  return result;
}

export function findClaudeConfigByUserId(userId: number): SelectUserClaudeConfig | undefined {
  const db = getDb();
  return db.select().from(userClaudeConfigs).where(eq(userClaudeConfigs.userId, userId)).get();
}

export function deleteTestClaudeConfig(userId: number): void {
  const db = getDb();
  db.delete(userClaudeConfigs).where(eq(userClaudeConfigs.userId, userId)).run();
}

// ============================================================================
// Build Helpers
// ============================================================================

export interface CreateTestBuildOptions {
  status?: 'pending' | 'running' | 'success' | 'failed';
  previewPort?: number;
}

export function createTestBuild(
  projectId: number,
  options: CreateTestBuildOptions = {}
): SelectBuild {
  const db = getDb();
  const result = db
    .insert(builds)
    .values({
      projectId,
      status: options.status || 'pending',
      previewPort: options.previewPort,
    })
    .returning()
    .get();
  return result;
}

export function findBuildById(id: number): SelectBuild | undefined {
  const db = getDb();
  return db.select().from(builds).where(eq(builds.id, id)).get();
}

export function findBuildsByProjectId(projectId: number): SelectBuild[] {
  const db = getDb();
  return db.select().from(builds).where(eq(builds.projectId, projectId)).all();
}

export function deleteTestBuild(id: number): void {
  const db = getDb();
  db.delete(builds).where(eq(builds.id, id)).run();
}

export function updateTestBuildStatus(
  id: number,
  status: 'pending' | 'running' | 'success' | 'failed',
  previewPort?: number
): SelectBuild | undefined {
  const db = getDb();
  const updateData: Partial<InsertBuild> = { status };
  if (previewPort !== undefined) {
    updateData.previewPort = previewPort;
  }
  return db.update(builds).set(updateData).where(eq(builds.id, id)).returning().get();
}
