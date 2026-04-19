import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { OrganizationController } from '../../../src/modules/organization/controller.js';
import { OrganizationService } from '../../../src/modules/organization/service.js';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let mockService: Partial<OrganizationService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      findByUserId: vi.fn(),
      findById: vi.fn(),
      updateName: vi.fn(),
      delete: vi.fn(),
    };

    controller = new OrganizationController(mockService as OrganizationService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: vi.fn() });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('create', () => {
    it('should create organization and return 201', async () => {
      mockReq.userId = 1;
      mockReq.body = { name: 'Test Org' };
      (mockService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, name: 'Test Org', createdBy: 1, createdAt: '2026-01-01',
      });

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockService.create).toHaveBeenCalledWith(1, { name: 'Test Org' });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { id: 1, name: 'Test Org', createdBy: 1, createdAt: '2026-01-01' },
      });
    });
  });

  describe('list', () => {
    it('should return organizations for user', async () => {
      mockReq.userId = 1;
      (mockService.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, name: 'Org 1', role: 'owner', createdBy: 1, createdAt: '2026-01-01' },
      ]);

      await controller.list(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: [{ id: 1, name: 'Org 1', role: 'owner', createdBy: 1, createdAt: '2026-01-01' }],
      });
    });
  });

  describe('get', () => {
    it('should return organization detail', async () => {
      mockReq.userId = 1;
      mockReq.params = { id: '1' };
      (mockService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, name: 'Org 1', members: [], createdBy: 1, createdAt: '2026-01-01',
      });

      await controller.get(mockReq as Request, mockRes as Response);

      expect(mockService.findById).toHaveBeenCalledWith(1, 1);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { id: 1, name: 'Org 1', members: [], createdBy: 1, createdAt: '2026-01-01' },
      });
    });
  });

  describe('update', () => {
    it('should update organization name', async () => {
      mockReq.userId = 1;
      mockReq.params = { id: '1' };
      mockReq.body = { name: 'Updated Org' };
      (mockService.updateName as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, name: 'Updated Org',
      });

      await controller.update(mockReq as Request, mockRes as Response);

      expect(mockService.updateName).toHaveBeenCalledWith(1, 1, { name: 'Updated Org' });
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { id: 1, name: 'Updated Org' },
      });
    });
  });

  describe('delete', () => {
    it('should delete organization and return 204', async () => {
      mockReq.userId = 1;
      mockReq.params = { id: '1' };
      (mockService.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockService.delete).toHaveBeenCalledWith(1, 1);
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });
});
