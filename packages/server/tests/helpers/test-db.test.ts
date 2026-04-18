import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSqliteDb, closeDb } from '../../src/db/index.js';
import { initSchema } from '../../src/db/schema.js';
import type Database from 'better-sqlite3';

// Import all helpers to verify they are exported correctly
import {
  createTestUser,
  findUserByEmail,
  findUserById,
  deleteTestUser,
  createTestOrganization,
  findOrganizationById,
  createTestOrganizationMember,
  createTestProject,
  findProjectById,
  findProjectsByOrganizationId,
  deleteTestProject,
  updateTestProjectStatus,
  createTestDraft,
  findDraftById,
  deleteTestDraft,
  updateTestDraftStatus,
  createTestDraftMember,
  findDraftMembers,
  createTestDraftMessage,
  findDraftMessages,
  createTestMessageConfirmation,
  findMessageConfirmations,
  createTestToken,
  findTokensByUserId,
  findTokenByUserIdAndProvider,
  deleteTestToken,
  createTestRepo,
  findReposByProjectId,
  findRepoById,
  deleteTestRepo,
  createTestClaudeConfig,
  findClaudeConfigByUserId,
  deleteTestClaudeConfig,
  createTestBuild,
  findBuildById,
  findBuildsByProjectId,
  deleteTestBuild,
  updateTestBuildStatus,
} from './test-db.js';

describe('Test Helpers Module', () => {
  let db: Database.Database;

  beforeEach(() => {
    closeDb();
    db = getSqliteDb(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    closeDb();
  });

  describe('User Helpers', () => {
    it('should create a test user', () => {
      const user = createTestUser({ name: 'Test User', email: 'test@test.com' });
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@test.com');
    });

    it('should find user by email', () => {
      createTestUser({ email: 'find@test.com' });
      const user = findUserByEmail('find@test.com');
      expect(user).toBeDefined();
      expect(user?.email).toBe('find@test.com');
    });

    it('should find user by id', () => {
      const created = createTestUser();
      const user = findUserById(created.id);
      expect(user).toBeDefined();
      expect(user?.id).toBe(created.id);
    });

    it('should delete a test user', () => {
      const user = createTestUser({ email: 'delete@test.com' });
      deleteTestUser(user.id);
      const found = findUserById(user.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Organization Helpers', () => {
    it('should create a test organization', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id, { name: 'Test Org' });
      expect(org.id).toBeDefined();
      expect(org.name).toBe('Test Org');
      expect(org.createdBy).toBe(user.id);
    });

    it('should find organization by id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const found = findOrganizationById(org.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(org.id);
    });

    it('should create an organization member', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const member = createTestOrganizationMember(org.id, user.id, 'owner', user.id);
      expect(member.organizationId).toBe(org.id);
      expect(member.userId).toBe(user.id);
      expect(member.role).toBe('owner');
    });
  });

  describe('Project Helpers', () => {
    it('should create a test project', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id, { name: 'Test Project' });
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.organizationId).toBe(org.id);
    });

    it('should find project by id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const found = findProjectById(project.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(project.id);
    });

    it('should find projects by organization id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      createTestProject(user.id, org.id, { name: 'Project 1' });
      createTestProject(user.id, org.id, { name: 'Project 2' });
      const projects = findProjectsByOrganizationId(org.id);
      expect(projects).toHaveLength(2);
    });

    it('should update project status', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const updated = updateTestProjectStatus(project.id, 'running', 'container-123');
      expect(updated?.status).toBe('running');
      expect(updated?.containerId).toBe('container-123');
    });

    it('should delete a test project', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      deleteTestProject(project.id);
      const found = findProjectById(project.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Draft Helpers', () => {
    it('should create a test draft', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id, { title: 'Test Draft' });
      expect(draft.id).toBeDefined();
      expect(draft.title).toBe('Test Draft');
      expect(draft.projectId).toBe(project.id);
    });

    it('should find draft by id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      const found = findDraftById(draft.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(draft.id);
    });

    it('should update draft status', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      const updated = updateTestDraftStatus(draft.id, 'confirmed');
      expect(updated?.status).toBe('confirmed');
    });

    it('should delete a test draft', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      deleteTestDraft(draft.id);
      const found = findDraftById(draft.id);
      expect(found).toBeUndefined();
    });

    it('should create draft member', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      const member = createTestDraftMember(draft.id, user.id, 'owner');
      expect(member.draftId).toBe(draft.id);
      expect(member.userId).toBe(user.id);
      expect(member.role).toBe('owner');
    });

    it('should find draft members', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      createTestDraftMember(draft.id, user.id);
      const members = findDraftMembers(draft.id);
      expect(members).toHaveLength(1);
    });

    it('should create draft message', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      const message = createTestDraftMessage(draft.id, user.id, { content: 'Test message' });
      expect(message.id).toBeDefined();
      expect(message.content).toBe('Test message');
    });

    it('should find draft messages', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      createTestDraftMessage(draft.id, user.id);
      createTestDraftMessage(draft.id, user.id);
      const messages = findDraftMessages(draft.id);
      expect(messages).toHaveLength(2);
    });

    it('should create message confirmation', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      const message = createTestDraftMessage(draft.id, user.id);
      const confirmation = createTestMessageConfirmation(message.id, user.id, 'agree', 'Looks good');
      expect(confirmation.messageId).toBe(message.id);
      expect(confirmation.userId).toBe(user.id);
      expect(confirmation.type).toBe('agree');
      expect(confirmation.comment).toBe('Looks good');
    });

    it('should find message confirmations', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const draft = createTestDraft(user.id, project.id);
      const message = createTestDraftMessage(draft.id, user.id);
      createTestMessageConfirmation(message.id, user.id, 'agree');
      const confirmations = findMessageConfirmations(message.id);
      expect(confirmations).toHaveLength(1);
    });
  });

  describe('Token Helpers', () => {
    it('should create a test token', () => {
      const user = createTestUser();
      const token = createTestToken(user.id, 'github', { accessToken: 'test-token' });
      expect(token.id).toBeDefined();
      expect(token.userId).toBe(user.id);
      expect(token.provider).toBe('github');
      expect(token.accessToken).toBe('test-token');
    });

    it('should find tokens by user id', () => {
      const user = createTestUser();
      createTestToken(user.id, 'github');
      createTestToken(user.id, 'gitlab');
      const tokens = findTokensByUserId(user.id);
      expect(tokens).toHaveLength(2);
    });

    it('should find token by user id and provider', () => {
      const user = createTestUser();
      createTestToken(user.id, 'github');
      const token = findTokenByUserIdAndProvider(user.id, 'github');
      expect(token).toBeDefined();
      expect(token?.provider).toBe('github');
    });

    it('should delete a test token', () => {
      const user = createTestUser();
      createTestToken(user.id, 'github');
      deleteTestToken(user.id, 'github');
      const token = findTokenByUserIdAndProvider(user.id, 'github');
      expect(token).toBeUndefined();
    });
  });

  describe('Repo Helpers', () => {
    it('should create a test repo', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const repo = createTestRepo(project.id, { repoName: 'test/repo' });
      expect(repo.id).toBeDefined();
      expect(repo.projectId).toBe(project.id);
      expect(repo.repoName).toBe('test/repo');
    });

    it('should find repos by project id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      createTestRepo(project.id);
      createTestRepo(project.id, { provider: 'gitlab' });
      const repos = findReposByProjectId(project.id);
      expect(repos).toHaveLength(2);
    });

    it('should find repo by id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const repo = createTestRepo(project.id);
      const found = findRepoById(repo.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(repo.id);
    });

    it('should delete a test repo', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const repo = createTestRepo(project.id);
      deleteTestRepo(repo.id);
      const found = findRepoById(repo.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Claude Config Helpers', () => {
    it('should create a test claude config', () => {
      const user = createTestUser();
      const config = createTestClaudeConfig(user.id, '{"apiKey": "test"}');
      expect(config.id).toBeDefined();
      expect(config.userId).toBe(user.id);
      expect(config.config).toBe('{"apiKey": "test"}');
    });

    it('should find claude config by user id', () => {
      const user = createTestUser();
      createTestClaudeConfig(user.id, '{"test": true}');
      const config = findClaudeConfigByUserId(user.id);
      expect(config).toBeDefined();
      expect(config?.userId).toBe(user.id);
    });

    it('should delete a test claude config', () => {
      const user = createTestUser();
      createTestClaudeConfig(user.id, '{}');
      deleteTestClaudeConfig(user.id);
      const config = findClaudeConfigByUserId(user.id);
      expect(config).toBeUndefined();
    });
  });

  describe('Build Helpers', () => {
    it('should create a test build', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const build = createTestBuild(project.id, { status: 'pending' });
      expect(build.id).toBeDefined();
      expect(build.projectId).toBe(project.id);
      expect(build.status).toBe('pending');
    });

    it('should find build by id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const build = createTestBuild(project.id);
      const found = findBuildById(build.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(build.id);
    });

    it('should find builds by project id', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      createTestBuild(project.id);
      createTestBuild(project.id);
      const builds = findBuildsByProjectId(project.id);
      expect(builds).toHaveLength(2);
    });

    it('should update build status', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const build = createTestBuild(project.id);
      const updated = updateTestBuildStatus(build.id, 'success', 3000);
      expect(updated?.status).toBe('success');
      expect(updated?.previewPort).toBe(3000);
    });

    it('should delete a test build', () => {
      const user = createTestUser();
      const org = createTestOrganization(user.id);
      const project = createTestProject(user.id, org.id);
      const build = createTestBuild(project.id);
      deleteTestBuild(build.id);
      const found = findBuildById(build.id);
      expect(found).toBeUndefined();
    });
  });
});