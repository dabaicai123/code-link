import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { DraftService } from '../../../src/modules/draft/service.js';
import { DraftRepository } from '../../../src/modules/draft/repository.js';
import { ProjectRepository } from '../../../src/modules/project/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { DatabaseConnection } from '../../../src/core/database/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { registerServiceModules } from '../../helpers/service-modules.js';
import { createSqliteDb, runMigrations } from '../../../src/db/index.js';
import { organizationMembers } from '../../../src/db/schema/index.js';

// Mock AI command functions from the draft module
vi.mock('../../../src/modules/draft/lib/commands.js', () => ({
  parseAICommand: vi.fn((content: string) => {
    if (content.startsWith('@AI generate')) {
      return { type: 'generate', target: 'test target', rawContent: content };
    }
    return null;
  }),
  executeAICommand: vi.fn(async () => ({
    success: true,
    response: 'AI response content',
    commandType: 'generate',
  })),
  isAICommand: vi.fn((content: string) => content.trim().startsWith('@AI')),
}));

describe('DraftService', () => {
  let service: DraftService;
  let db: DatabaseConnection;
  let authRepo: AuthRepository;
  let orgRepo: OrganizationRepository;
  let projectRepo: ProjectRepository;
  let draftRepo: DraftRepository;
  let userId: number;
  let projectId: number;
  let orgId: number;

  beforeEach(async () => {
    container.reset();
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    const sqlite = createSqliteDb(':memory:');
    runMigrations(sqlite);
    db = DatabaseConnection.fromSqlite(sqlite);
    container.registerInstance(DatabaseConnection, db);

    registerServiceModules();

    service = container.resolve(DraftService);
    authRepo = container.resolve(AuthRepository);
    orgRepo = container.resolve(OrganizationRepository);
    projectRepo = container.resolve(ProjectRepository);
    draftRepo = container.resolve(DraftRepository);

    // Create test user
    const user = await authRepo.create({ name: 'Test User', email: 'test@test.com', passwordHash: 'hash' });
    userId = user.id;

    // Create test organization
    const org = await orgRepo.createWithOwner('Test Org', userId);
    orgId = org.id;

    // Create test project
    const project = await projectRepo.create({
      name: 'Test Project',
      templateType: 'node',
      organizationId: orgId,
      createdBy: userId,
    });
    projectId = project.id;
  });

  afterEach(() => {
    db.close();
    container.reset();
  });

  // ==================== Draft CRUD Tests ====================

  describe('create', () => {
    it('should create draft with valid input', async () => {
      const result = await service.create(userId, {
        projectId,
        title: 'Test Draft',
        memberIds: [],
      });

      expect(result.title).toBe('Test Draft');
      expect(result.projectId).toBe(projectId);
      expect(result.createdBy).toBe(userId);
      expect(result.status).toBe('discussing');
    });

    it('should throw ParamError for empty title', async () => {
      await expect(service.create(userId, {
        projectId,
        title: '',
        memberIds: [],
      })).rejects.toThrow('标题不能为空');
    });

    it('should throw ParamError for title exceeding max length', async () => {
      await expect(service.create(userId, {
        projectId,
        title: 'a'.repeat(201),
        memberIds: [],
      })).rejects.toThrow('标题最多200个字符');
    });

    it('should add additional members when memberIds provided', async () => {
      const memberUser = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });

      const result = await service.create(userId, {
        projectId,
        title: 'Test Draft',
        memberIds: [memberUser.id],
      });

      const members = await draftRepo.findMembers(result.id);
      expect(members.length).toBe(2); // owner + member
      expect(members.find(m => m.userId === userId)?.role).toBe('owner');
      expect(members.find(m => m.userId === memberUser.id)?.role).toBe('participant');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(service.create(userId, {
        projectId: 99999,
        title: 'Test Draft',
        memberIds: [],
      })).rejects.toThrow('项目不存在');
    });

    it('should throw PermissionError for non-org-member', async () => {
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.create(outsider.id, {
        projectId,
        title: 'Test Draft',
        memberIds: [],
      })).rejects.toThrow('您没有权限访问该项目');
    });
  });

  describe('findById', () => {
    it('should return draft with members', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      const result = await service.findById(draft.id, userId);

      expect(result.draft.title).toBe('Test Draft');
      expect(result.members.length).toBe(1);
      expect(result.members[0].userId).toBe(userId);
      expect(result.members[0].role).toBe('owner');
    });

    it('should throw NotFoundError for non-existent draft', async () => {
      await expect(service.findById(99999, userId))
        .rejects.toThrow('草稿不存在');
    });

    it('should throw PermissionError for non-member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.findById(draft.id, outsider.id))
        .rejects.toThrow('您没有权限访问该草稿');
    });

    it('should allow admin to access any draft', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const admin = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      const result = await service.findById(draft.id, admin.id);
      expect(result.draft.title).toBe('Test Draft');
    });
  });

  describe('findByUserId', () => {
    it('should return drafts where user is owner', async () => {
      await draftRepo.createWithOwner({ projectId, title: 'Draft 1', createdBy: userId }, userId);
      await draftRepo.createWithOwner({ projectId, title: 'Draft 2', createdBy: userId }, userId);

      const result = await service.findByUserId(userId);

      expect(result.data.length).toBe(2);
    });

    it('should return drafts where user is participant', async () => {
      const owner = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });
      const participant = await authRepo.create({ name: 'Participant', email: 'participant@test.com', passwordHash: 'hash' });

      // Add participant to org first
      db.getDb().insert(organizationMembers).values({
        organizationId: orgId,
        userId: participant.id,
        role: 'member',
        invitedBy: owner.id,
      }).run();

      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      await draftRepo.addMember(draft.id, participant.id);

      const result = await service.findByUserId(participant.id);
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Test Draft');
    });

    it('should return empty result for user with no drafts', async () => {
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      const result = await service.findByUserId(outsider.id);
      expect(result.data).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update draft status', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      const result = await service.updateStatus(draft.id, userId, 'brainstorming');

      expect(result.status).toBe('brainstorming');
    });

    it('should throw NotFoundError for non-existent draft', async () => {
      await expect(service.updateStatus(99999, userId, 'brainstorming'))
        .rejects.toThrow('草稿不存在');
    });

    it('should throw PermissionError for non-member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.updateStatus(draft.id, outsider.id, 'brainstorming'))
        .rejects.toThrow('您没有权限访问该草稿');
    });
  });

  describe('delete', () => {
    it('should delete draft by owner', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      await service.delete(draft.id, userId);

      const found = await draftRepo.findById(draft.id);
      expect(found).toBeUndefined();
    });

    it('should throw NotFoundError for non-existent draft', async () => {
      await expect(service.delete(99999, userId))
        .rejects.toThrow('草稿不存在');
    });

    it('should throw PermissionError for non-owner', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const participant = await authRepo.create({ name: 'Participant', email: 'participant@test.com', passwordHash: 'hash' });

      // Add participant to org
      db.getDb().insert(organizationMembers).values({
        organizationId: orgId,
        userId: participant.id,
        role: 'member',
        invitedBy: userId,
      }).run();

      await draftRepo.addMember(draft.id, participant.id);

      await expect(service.delete(draft.id, participant.id))
        .rejects.toThrow('只有草稿 owner 可以删除');
    });

    it('should allow admin to delete any draft', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const admin = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      await service.delete(draft.id, admin.id);

      const found = await draftRepo.findById(draft.id);
      expect(found).toBeUndefined();
    });
  });

  // ==================== Member Management Tests ====================

  describe('addMember', () => {
    it('should add member to draft', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const newMember = await authRepo.create({ name: 'New Member', email: 'newmember@test.com', passwordHash: 'hash' });

      // Add to org first
      db.getDb().insert(organizationMembers).values({
        organizationId: orgId,
        userId: newMember.id,
        role: 'member',
        invitedBy: userId,
      }).run();

      await service.addMember(draft.id, userId, newMember.id);

      const members = await draftRepo.findMembers(draft.id);
      expect(members.length).toBe(2);
      expect(members.find(m => m.userId === newMember.id)).toBeDefined();
    });

    it('should throw PermissionError if user not draft member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });
      const newMember = await authRepo.create({ name: 'New Member', email: 'newmember@test.com', passwordHash: 'hash' });

      await expect(service.addMember(draft.id, outsider.id, newMember.id))
        .rejects.toThrow('您没有权限访问该草稿');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      await expect(service.addMember(draft.id, userId, 99999))
        .rejects.toThrow('用户不存在');
    });
  });

  describe('removeMember', () => {
    it('should remove member from draft', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const participant = await authRepo.create({ name: 'Participant', email: 'participant@test.com', passwordHash: 'hash' });

      // Add to org
      db.getDb().insert(organizationMembers).values({
        organizationId: orgId,
        userId: participant.id,
        role: 'member',
        invitedBy: userId,
      }).run();

      const member = await draftRepo.addMember(draft.id, participant.id);

      await service.removeMember(draft.id, userId, member.id);

      const members = await draftRepo.findMembers(draft.id);
      expect(members.length).toBe(1);
      expect(members.find(m => m.userId === participant.id)).toBeUndefined();
    });

    it('should throw PermissionError if user not draft member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });
      const participant = await authRepo.create({ name: 'Participant', email: 'participant@test.com', passwordHash: 'hash' });

      await expect(service.removeMember(draft.id, outsider.id, participant.id))
        .rejects.toThrow('您没有权限访问该草稿');
    });
  });

  // ==================== Message Tests ====================

  describe('createMessage', () => {
    it('should create message in draft', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      const result = await service.createMessage(draft.id, userId, {
        content: 'Test message',
        messageType: 'text',
      });

      expect(result.content).toBe('Test message');
      expect(result.messageType).toBe('text');
      expect(result.userId).toBe(userId);
    });

    it('should throw NotFoundError for non-existent draft', async () => {
      await expect(service.createMessage(99999, userId, { content: 'Test' }))
        .rejects.toThrow('草稿不存在');
    });

    it('should throw PermissionError for non-member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.createMessage(draft.id, outsider.id, { content: 'Test' }))
        .rejects.toThrow('您没有权限访问该草稿');
    });
  });

  describe('findMessages', () => {
    it('should return messages for draft', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      await draftRepo.createMessage({ draftId: draft.id, userId, content: 'Message 1' });
      await draftRepo.createMessage({ draftId: draft.id, userId, content: 'Message 2' });

      const result = await service.findMessages(draft.id, userId);

      expect(result.data.length).toBe(2);
    });

    it('should throw PermissionError for non-member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.findMessages(draft.id, outsider.id))
        .rejects.toThrow('您没有权限访问该草稿');
    });
  });

  // ==================== Confirmation Tests ====================

  describe('confirmMessage', () => {
    it('should create confirmation for message', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const message = await draftRepo.createMessage({ draftId: draft.id, userId, content: 'Test message' });

      const result = await service.confirmMessage(draft.id, message.id, userId, {
        type: 'agree',
      });

      expect(result.type).toBe('agree');
      expect(result.userId).toBe(userId);
    });

    it('should throw NotFoundError for non-existent message', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      await expect(service.confirmMessage(draft.id, 99999, userId, { type: 'agree' }))
        .rejects.toThrow('消息不存在');
    });

    it('should throw PermissionError for non-member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const message = await draftRepo.createMessage({ draftId: draft.id, userId, content: 'Test message' });
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.confirmMessage(draft.id, message.id, outsider.id, { type: 'agree' }))
        .rejects.toThrow('您没有权限访问该草稿');
    });
  });

  describe('findConfirmations', () => {
    it('should return confirmations for message', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const message = await draftRepo.createMessage({ draftId: draft.id, userId, content: 'Test message' });

      await draftRepo.upsertConfirmation({ messageId: message.id, userId, type: 'agree' });

      const result = await service.findConfirmations(draft.id, message.id, userId);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('agree');
    });

    it('should throw NotFoundError for non-existent message', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      await expect(service.findConfirmations(draft.id, 99999, userId))
        .rejects.toThrow('消息不存在');
    });
  });

  // ==================== AI Command Tests ====================

  describe('handleAICommand', () => {
    it('should handle AI command and create response message', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      const result = await service.handleAICommand(draft.id, userId, '@AI generate test target');

      expect(result.success).toBe(true);
      expect(result.response).toBe('AI response content');
    });

    it('should throw PermissionError for non-member', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.handleAICommand(draft.id, outsider.id, '@AI generate test'))
        .rejects.toThrow('您没有权限访问该草稿');
    });

    it('should throw ParamError for invalid command', async () => {
      const draft = await draftRepo.createWithOwner({ projectId, title: 'Test Draft', createdBy: userId }, userId);

      await expect(service.handleAICommand(draft.id, userId, 'not an AI command'))
        .rejects.toThrow('无效的 AI 命令格式');
    });
  });
});