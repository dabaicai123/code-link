import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { DraftRepository } from '../../../src/modules/draft/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { ProjectRepository } from '../../../src/modules/project/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { initSchema } from '../../../src/db/init.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-draft-repo.db');

describe('DraftRepository', () => {
  let repo: DraftRepository;
  let userRepo: AuthRepository;
  let orgRepo: OrganizationRepository;
  let projectRepo: ProjectRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    initSchema(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    repo = new DraftRepository(db);
    userRepo = new AuthRepository(db);
    orgRepo = new OrganizationRepository(db);
    projectRepo = new ProjectRepository(db);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  // Helper function to setup test data: user, org, project
  async function setupTestData() {
    const user = await userRepo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });
    const org = await orgRepo.createWithOwner('Test Org', user.id);
    const project = await projectRepo.create({
      name: 'Test Project',
      templateType: 'node',
      organizationId: org.id,
      createdBy: user.id,
    });
    return { user, org, project };
  }

  describe('Draft operations', () => {
    it('should create a draft', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      expect(draft.id).toBeDefined();
      expect(draft.projectId).toBe(project.id);
      expect(draft.title).toBe('Test Draft');
      expect(draft.status).toBe('discussing');
    });

    it('should find draft by id', async () => {
      const { user, project } = await setupTestData();

      const created = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Test Draft');
    });

    it('should return undefined for non-existent draft', async () => {
      const found = await repo.findById(999);
      expect(found).toBeUndefined();
    });

    it('should find drafts by user id', async () => {
      const { user, project } = await setupTestData();
      const user2 = await userRepo.create({
        name: 'User 2',
        email: 'user2@example.com',
        passwordHash: 'hashedpassword',
      });

      // Create drafts for user1
      await repo.create({
        projectId: project.id,
        title: 'Draft 1',
        createdBy: user.id,
      });
      await repo.create({
        projectId: project.id,
        title: 'Draft 2',
        createdBy: user.id,
      });

      // Create draft for user2
      await repo.create({
        projectId: project.id,
        title: 'Draft 3',
        createdBy: user2.id,
      });

      const drafts = await repo.findByUserId(user.id);
      expect(drafts).toHaveLength(2);
      expect(drafts.map(d => d.title)).toContain('Draft 1');
      expect(drafts.map(d => d.title)).toContain('Draft 2');
    });

    it('should update draft status', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const updated = await repo.updateStatus(draft.id, 'reviewing');
      expect(updated.status).toBe('reviewing');
    });

    it('should touch draft (update updatedAt)', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const originalUpdatedAt = draft.updatedAt;

      // Wait for at least 1 second since SQLite datetime('now') has second precision
      await new Promise(resolve => setTimeout(resolve, 1100));

      await repo.touch(draft.id);
      const found = await repo.findById(draft.id);
      expect(found?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should delete a draft', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      await repo.delete(draft.id);
      const found = await repo.findById(draft.id);
      expect(found).toBeUndefined();
    });

    it('should create draft with owner', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.createWithOwner({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      }, user.id);

      expect(draft.id).toBeDefined();
      expect(draft.title).toBe('Test Draft');

      // Verify owner member was created
      const members = await repo.findMembers(draft.id);
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(user.id);
      expect(members[0].role).toBe('owner');
    });
  });

  describe('Member operations', () => {
    it('should add a member to draft', async () => {
      const { user, project } = await setupTestData();
      const member = await userRepo.create({
        name: 'Member',
        email: 'member@example.com',
        passwordHash: 'hashedpassword',
      });

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const addedMember = await repo.addMember(draft.id, member.id, 'participant');
      expect(addedMember.draftId).toBe(draft.id);
      expect(addedMember.userId).toBe(member.id);
      expect(addedMember.role).toBe('participant');
    });

    it('should find a specific member', async () => {
      const { user, project } = await setupTestData();
      const member = await userRepo.create({
        name: 'Member',
        email: 'member@example.com',
        passwordHash: 'hashedpassword',
      });

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      await repo.addMember(draft.id, member.id, 'participant');

      const found = await repo.findMember(draft.id, member.id);
      expect(found).toBeDefined();
      expect(found?.userId).toBe(member.id);
    });

    it('should find all members of a draft', async () => {
      const { user, project } = await setupTestData();
      const member1 = await userRepo.create({
        name: 'Member 1',
        email: 'member1@example.com',
        passwordHash: 'hashedpassword',
      });
      const member2 = await userRepo.create({
        name: 'Member 2',
        email: 'member2@example.com',
        passwordHash: 'hashedpassword',
      });

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      await repo.addMember(draft.id, user.id, 'owner');
      await repo.addMember(draft.id, member1.id, 'participant');
      await repo.addMember(draft.id, member2.id, 'participant');

      const members = await repo.findMembers(draft.id);
      expect(members).toHaveLength(3);
    });

    it('should remove a member from draft', async () => {
      const { user, project } = await setupTestData();
      const member = await userRepo.create({
        name: 'Member',
        email: 'member@example.com',
        passwordHash: 'hashedpassword',
      });

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      await repo.addMember(draft.id, member.id, 'participant');
      await repo.removeMember(draft.id, member.id);

      const found = await repo.findMember(draft.id, member.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Message operations', () => {
    it('should create a message', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const message = await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Test message',
        messageType: 'text',
      });

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Test message');
      expect(message.messageType).toBe('text');
    });

    it('should find messages by draft id', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Message 1',
        messageType: 'text',
      });
      await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Message 2',
        messageType: 'text',
      });

      const messages = await repo.findMessages(draft.id);
      expect(messages).toHaveLength(2);
    });

    it('should find a specific message', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const created = await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Test message',
        messageType: 'text',
      });

      const found = await repo.findMessage(draft.id, created.id);
      expect(found).toBeDefined();
      expect(found?.content).toBe('Test message');
    });
  });

  describe('Confirmation operations', () => {
    it('should upsert a confirmation', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const message = await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Test message',
        messageType: 'text',
      });

      const confirmation = await repo.upsertConfirmation({
        messageId: message.id,
        userId: user.id,
        type: 'agree',
      });

      expect(confirmation.messageId).toBe(message.id);
      expect(confirmation.type).toBe('agree');
    });

    it('should update existing confirmation on upsert', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const message = await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Test message',
        messageType: 'text',
      });

      await repo.upsertConfirmation({
        messageId: message.id,
        userId: user.id,
        type: 'agree',
      });

      const updated = await repo.upsertConfirmation({
        messageId: message.id,
        userId: user.id,
        type: 'disagree',
        comment: 'Changed my mind',
      });

      expect(updated.type).toBe('disagree');
      expect(updated.comment).toBe('Changed my mind');
    });

    it('should find confirmations for a message', async () => {
      const { user, project } = await setupTestData();
      const user2 = await userRepo.create({
        name: 'User 2',
        email: 'user2@example.com',
        passwordHash: 'hashedpassword',
      });

      const draft = await repo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const message = await repo.createMessage({
        draftId: draft.id,
        userId: user.id,
        content: 'Test message',
        messageType: 'text',
      });

      await repo.upsertConfirmation({
        messageId: message.id,
        userId: user.id,
        type: 'agree',
      });
      await repo.upsertConfirmation({
        messageId: message.id,
        userId: user2.id,
        type: 'disagree',
        comment: 'Need changes',
      });

      const confirmations = await repo.findConfirmations(message.id);
      expect(confirmations).toHaveLength(2);
    });
  });

  describe('Draft context', () => {
    it('should find draft context with project info', async () => {
      const { user, project } = await setupTestData();

      const draft = await repo.createWithOwner({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      }, user.id);

      const context = await repo.findDraftContext(draft.id);
      expect(context).toBeDefined();
      expect(context?.draft.projectName).toBe('Test Project');
      expect(context?.draft.projectTemplate).toBe('node');
      expect(context?.members).toHaveLength(1);
    });

    it('should return undefined for non-existent draft context', async () => {
      const context = await repo.findDraftContext(999);
      expect(context).toBeUndefined();
    });
  });
});
