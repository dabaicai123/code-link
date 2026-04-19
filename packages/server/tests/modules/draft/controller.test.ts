import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { DraftController } from '../../../src/modules/draft/controller.js';
import { DraftService } from '../../../src/modules/draft/service.js';

describe('DraftController', () => {
  let controller: DraftController;
  let mockService: Partial<DraftService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
      createMessage: vi.fn(),
      findMessages: vi.fn(),
      confirmMessage: vi.fn(),
      findConfirmations: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
    };

    controller = new DraftController(mockService as DraftService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: vi.fn() });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('create', () => {
    it('should create draft and return 201', async () => {
      mockReq.userId = 1;
      mockReq.body = { projectId: 1, title: 'Test Draft' };
      (mockService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, projectId: 1, title: 'Test Draft', status: 'discussing', createdBy: 1, createdAt: new Date(), updatedAt: new Date(),
      });

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockService.create).toHaveBeenCalledWith(1, { projectId: 1, title: 'Test Draft' });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.objectContaining({ id: 1, title: 'Test Draft' }),
      });
    });

    it('should create draft with memberIds', async () => {
      mockReq.userId = 1;
      mockReq.body = { projectId: 1, title: 'Test Draft', memberIds: [2, 3] };
      (mockService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, projectId: 1, title: 'Test Draft', status: 'discussing', createdBy: 1, createdAt: new Date(), updatedAt: new Date(),
      });

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockService.create).toHaveBeenCalledWith(1, { projectId: 1, title: 'Test Draft', memberIds: [2, 3] });
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('list', () => {
    it('should return drafts for user', async () => {
      mockReq.userId = 1;
      (mockService.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, projectId: 1, title: 'Draft 1', status: 'discussing', createdBy: 1, createdAt: new Date(), updatedAt: new Date() },
      ]);

      await controller.list(mockReq as Request, mockRes as Response);

      expect(mockService.findByUserId).toHaveBeenCalledWith(1);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.arrayContaining([expect.objectContaining({ id: 1 })]),
      });
    });
  });

  describe('get', () => {
    it('should return draft detail', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      (mockService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        draft: { id: 1, projectId: 1, title: 'Draft 1', status: 'discussing', createdBy: 1, createdAt: new Date(), updatedAt: new Date() },
        members: [],
      });

      await controller.get(mockReq as Request, mockRes as Response);

      expect(mockService.findById).toHaveBeenCalledWith(1, 1);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.objectContaining({ draft: expect.objectContaining({ id: 1 }) }),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update draft status', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      mockReq.body = { status: 'reviewing' };
      (mockService.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, status: 'reviewing',
      });

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockService.updateStatus).toHaveBeenCalledWith(1, 1, 'reviewing');
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { id: 1, status: 'reviewing' },
      });
    });
  });

  describe('delete', () => {
    it('should delete draft and return 204', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      (mockService.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockService.delete).toHaveBeenCalledWith(1, 1);
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });

  describe('createMessage', () => {
    it('should create message and return 201', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      mockReq.body = { content: 'Hello World', messageType: 'text' };
      (mockService.createMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, draftId: 1, userId: 1, content: 'Hello World', messageType: 'text', userName: 'User 1', createdAt: new Date(),
      });

      await controller.createMessage(mockReq as Request, mockRes as Response);

      expect(mockService.createMessage).toHaveBeenCalledWith(1, 1, { content: 'Hello World', messageType: 'text' });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.objectContaining({ content: 'Hello World' }),
      });
    });

    it('should create message with parentId and metadata', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      mockReq.body = { content: 'Reply', parentId: 5, metadata: { key: 'value' } };
      (mockService.createMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 2, draftId: 1, userId: 1, content: 'Reply', parentId: 5, userName: 'User 1', createdAt: new Date(),
      });

      await controller.createMessage(mockReq as Request, mockRes as Response);

      expect(mockService.createMessage).toHaveBeenCalledWith(1, 1, { content: 'Reply', parentId: 5, metadata: { key: 'value' } });
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('listMessages', () => {
    it('should return messages for draft', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      mockReq.query = {};
      (mockService.findMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, draftId: 1, userId: 1, content: 'Message 1', messageType: 'text', userName: 'User 1', createdAt: new Date() },
      ]);

      await controller.listMessages(mockReq as Request, mockRes as Response);

      expect(mockService.findMessages).toHaveBeenCalledWith(1, 1, undefined);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.arrayContaining([expect.objectContaining({ content: 'Message 1' })]),
      });
    });

    it('should pass limit parameter', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      mockReq.query = { limit: '10' };
      (mockService.findMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await controller.listMessages(mockReq as Request, mockRes as Response);

      expect(mockService.findMessages).toHaveBeenCalledWith(1, 1, 10);
    });
  });

  describe('confirmMessage', () => {
    it('should confirm message and return result', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1', messageId: '5' };
      mockReq.body = { type: 'agree', comment: 'Looks good' };
      (mockService.confirmMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, messageId: 5, userId: 1, type: 'agree', comment: 'Looks good', userName: 'User 1', createdAt: new Date(),
      });

      await controller.confirmMessage(mockReq as Request, mockRes as Response);

      expect(mockService.confirmMessage).toHaveBeenCalledWith(1, 5, 1, { type: 'agree', comment: 'Looks good' });
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.objectContaining({ type: 'agree' }),
      });
    });
  });

  describe('listConfirmations', () => {
    it('should return confirmations for message', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1', messageId: '5' };
      (mockService.findConfirmations as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, messageId: 5, userId: 1, type: 'agree', userName: 'User 1', createdAt: new Date() },
      ]);

      await controller.listConfirmations(mockReq as Request, mockRes as Response);

      expect(mockService.findConfirmations).toHaveBeenCalledWith(1, 5, 1);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: expect.arrayContaining([expect.objectContaining({ type: 'agree' })]),
      });
    });
  });

  describe('addMember', () => {
    it('should add member to draft', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1' };
      mockReq.body = { newUserId: 2 };
      (mockService.addMember as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await controller.addMember(mockReq as Request, mockRes as Response);

      expect(mockService.addMember).toHaveBeenCalledWith(1, 1, 2);
      expect(jsonMock).toHaveBeenCalledWith({ code: 0, data: null });
    });
  });

  describe('removeMember', () => {
    it('should remove member from draft', async () => {
      mockReq.userId = 1;
      mockReq.params = { draftId: '1', memberId: '2' };
      (mockService.removeMember as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await controller.removeMember(mockReq as Request, mockRes as Response);

      expect(mockService.removeMember).toHaveBeenCalledWith(1, 1, 2);
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });
});