/**
 * Test helpers module for Drizzle ORM operations
 * Provides functions for creating, finding, updating, and deleting test data
 */

import "reflect-metadata";
import { eq, and } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { container } from 'tsyringe';
import { DatabaseConnection, createSqliteDb, initSchema } from '../../src/db/index.js';
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

let currentDbConnection: DatabaseConnection | null = null;

export function setupTestDb(): Database.Database {
  // 清理之前的连接
  if (currentDbConnection) {
    currentDbConnection.close();
    currentDbConnection = null;
  }

  const sqlite = createSqliteDb(':memory:');
  initSchema(sqlite);

  container.reset();
  currentDbConnection = DatabaseConnection.fromSqlite(sqlite);
  container.registerInstance(DatabaseConnection, currentDbConnection);

  return sqlite;
}

export function teardownTestDb(): void {
  container.reset();
  if (currentDbConnection) {
    currentDbConnection.close();
    currentDbConnection = null;
  }
}

/**
 * 获取当前测试数据库的 Drizzle 实例
 */
function getTestDb() {
  if (!currentDbConnection) {
    throw new Error('Test database not initialized. Call setupTestDb() first.');
  }
  return currentDbConnection.getDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(users).where(eq(users.email, email)).get();
}

export function findUserById(id: number): SelectUser | undefined {
  const db = getTestDb();
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function deleteTestUser(id: number): void {
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(organizations).where(eq(organizations.id, id)).get();
}

export function createTestOrganizationMember(
  orgId: number,
  userId: number,
  role: 'owner' | 'developer' | 'member' = 'member',
  invitedBy: number
): SelectOrganizationMember {
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function findProjectsByOrganizationId(orgId: number): SelectProject[] {
  const db = getTestDb();
  return db.select().from(projects).where(eq(projects.organizationId, orgId)).all();
}

export function deleteTestProject(id: number): void {
  const db = getTestDb();
  db.delete(projects).where(eq(projects.id, id)).run();
}

export function updateTestProjectStatus(
  id: number,
  status: 'created' | 'running' | 'stopped',
  containerId?: string
): SelectProject | undefined {
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(drafts).where(eq(drafts.id, id)).get();
}

export function deleteTestDraft(id: number): void {
  const db = getTestDb();
  db.delete(drafts).where(eq(drafts.id, id)).run();
}

export function updateTestDraftStatus(
  id: number,
  status: 'discussing' | 'brainstorming' | 'reviewing' | 'developing' | 'confirmed' | 'archived'
): SelectDraft | undefined {
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(projectTokens).where(eq(projectTokens.userId, userId)).all();
}

export function findTokenByUserIdAndProvider(
  userId: number,
  provider: 'github' | 'gitlab'
): SelectProjectToken | undefined {
  const db = getTestDb();
  return db
    .select()
    .from(projectTokens)
    .where(and(eq(projectTokens.userId, userId), eq(projectTokens.provider, provider)))
    .get();
}

export function deleteTestToken(userId: number, provider: 'github' | 'gitlab'): void {
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(projectRepos).where(eq(projectRepos.projectId, projectId)).all();
}

export function findRepoById(id: number): SelectProjectRepo | undefined {
  const db = getTestDb();
  return db.select().from(projectRepos).where(eq(projectRepos.id, id)).get();
}

export function deleteTestRepo(id: number): void {
  const db = getTestDb();
  db.delete(projectRepos).where(eq(projectRepos.id, id)).run();
}

// ============================================================================
// Claude Config Helpers
// ============================================================================

export function createTestClaudeConfig(userId: number, config: string): SelectUserClaudeConfig {
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(userClaudeConfigs).where(eq(userClaudeConfigs.userId, userId)).get();
}

export function deleteTestClaudeConfig(userId: number): void {
  const db = getTestDb();
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
  const db = getTestDb();
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
  const db = getTestDb();
  return db.select().from(builds).where(eq(builds.id, id)).get();
}

export function findBuildsByProjectId(projectId: number): SelectBuild[] {
  const db = getTestDb();
  return db.select().from(builds).where(eq(builds.projectId, projectId)).all();
}

export function deleteTestBuild(id: number): void {
  const db = getTestDb();
  db.delete(builds).where(eq(builds.id, id)).run();
}

export function updateTestBuildStatus(
  id: number,
  status: 'pending' | 'running' | 'success' | 'failed',
  previewPort?: number
): SelectBuild | undefined {
  const db = getTestDb();
  const updateData: Partial<InsertBuild> = { status };
  if (previewPort !== undefined) {
    updateData.previewPort = previewPort;
  }
  return db.update(builds).set(updateData).where(eq(builds.id, id)).returning().get();
}