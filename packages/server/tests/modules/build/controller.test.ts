import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';

// Mock dependencies before importing
vi.mock('../../../src/build/build-manager.js', () => ({
  getBuildManager: vi.fn(),
}));

vi.mock('../../../src/build/preview-container.js', () => ({
  getPreviewContainerManager: vi.fn(),
}));

vi.mock('../../../src/websocket/server.js', () => ({
  getWebSocketServer: vi.fn(),
}));

import { BuildController } from '../../../src/modules/build/controller.js';
import { BuildService } from '../../../src/modules/build/service.js';

describe('BuildController', () => {
  let controller: BuildController;
  let mockService: Partial<BuildService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      findByProjectId: vi.fn(),
      findById: vi.fn(),
      getPreview: vi.fn(),
      stopPreview: vi.fn(),
    };

    controller = new BuildController(mockService as BuildService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: vi.fn() });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('create', () => {
    it('should create build and return 201', async () => {
      mockReq.userId = 1;
      mockReq.body = { projectId: 1 };
      (mockService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, projectId: 1, status: 'pending', previewPort: null, createdAt: '2026-01-01',
      });

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockService.create).toHaveBeenCalledWith(1, { projectId: 1 });
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('listByProject', () => {
    it('should return builds for project', async () => {
      mockReq.userId = 1;
      mockReq.params = { projectId: '1' };
      (mockService.findByProjectId as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, projectId: 1, status: 'success', previewPort: 3000, createdAt: '2026-01-01' },
      ]);

      await controller.listByProject(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: [{ id: 1, projectId: 1, status: 'success', previewPort: 3000, createdAt: '2026-01-01' }],
      });
    });
  });

  describe('get', () => {
    it('should return build detail', async () => {
      mockReq.userId = 1;
      mockReq.params = { id: '1' };
      (mockService.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1, projectId: 1, status: 'success', previewPort: 3000, createdAt: '2026-01-01',
      });

      await controller.get(mockReq as Request, mockRes as Response);

      expect(mockService.findById).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('getPreview', () => {
    it('should return preview info', async () => {
      mockReq.userId = 1;
      mockReq.params = { projectId: '1' };
      (mockService.getPreview as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: 'http://localhost:3000',
        port: 3000,
      });

      await controller.getPreview(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { url: 'http://localhost:3000', port: 3000 },
      });
    });
  });

  describe('stopPreview', () => {
    it('should stop preview and return 204', async () => {
      mockReq.userId = 1;
      mockReq.params = { projectId: '1' };
      (mockService.stopPreview as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await controller.stopPreview(mockReq as Request, mockRes as Response);

      expect(mockService.stopPreview).toHaveBeenCalledWith(1, 1);
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });
});
