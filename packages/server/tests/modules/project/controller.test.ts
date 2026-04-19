import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { ProjectController } from '../../../src/modules/project/controller.js';
import { ProjectService } from '../../../src/modules/project/service.js';

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockService: Partial<ProjectService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      findByUserId: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn(),
    };

    controller = new ProjectController(mockService as ProjectService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: vi.fn() });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('create', () => {
    it('should create project and return 201', async () => {
      mockReq.userId = 1;
      mockReq.body = { name: 'Test Project', templateType: 'node', organizationId: 1 };
      (mockService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, name: 'Test Project', templateType: 'node', organizationId: 1, createdBy: 1, status: 'created', containerId: null, createdAt: '2026-01-01',
      });

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockService.create).toHaveBeenCalledWith(1, { name: 'Test Project', templateType: 'node', organizationId: 1 });
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('list', () => {
    it('should return projects for user', async () => {
      mockReq.userId = 1;
      mockReq.query = {};
      (mockService.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, name: 'Project 1', templateType: 'node', organizationId: 1, createdBy: 1, status: 'created', containerId: null, createdAt: '2026-01-01' },
      ]);

      await controller.list(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: [{ id: 1, name: 'Project 1', templateType: 'node', organizationId: 1, createdBy: 1, status: 'created', containerId: null, createdAt: '2026-01-01' }],
      });
    });
  });

  describe('get', () => {
    it('should return project detail', async () => {
      mockReq.userId = 1;
      mockReq.params = { id: '1' };
      (mockService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, name: 'Project 1', members: [], repos: [], organizationId: 1, createdBy: 1, status: 'created', containerId: null, templateType: 'node', createdAt: '2026-01-01',
      });

      await controller.get(mockReq as Request, mockRes as Response);

      expect(mockService.findById).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('delete', () => {
    it('should delete project and return 204', async () => {
      mockReq.userId = 1;
      mockReq.params = { id: '1' };
      (mockService.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockService.delete).toHaveBeenCalledWith(1, 1);
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });
});