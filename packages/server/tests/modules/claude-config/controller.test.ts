import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { ClaudeConfigController } from '../../../src/modules/claude-config/controller.js';
import { ClaudeConfigService } from '../../../src/modules/claude-config/service.js';

describe('ClaudeConfigController', () => {
  let controller: ClaudeConfigController;
  let mockService: Partial<ClaudeConfigService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      getConfig: vi.fn(),
      saveConfig: vi.fn(),
      deleteConfig: vi.fn(),
      hasConfig: vi.fn(),
    };

    controller = new ClaudeConfigController(mockService as ClaudeConfigService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: vi.fn() });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('get', () => {
    it('should return config', async () => {
      mockReq.userId = 1;
      (mockService.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        config: { env: { ANTHROPIC_AUTH_TOKEN: 'test' } },
        hasConfig: true,
      });

      await controller.get(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { config: { env: { ANTHROPIC_AUTH_TOKEN: 'test' } }, hasConfig: true },
      });
    });
  });

  describe('save', () => {
    it('should save config and return success', async () => {
      mockReq.userId = 1;
      mockReq.body = {
        config: {
          env: { ANTHROPIC_AUTH_TOKEN: 'test-token' },
          skipDangerousModePermissionPrompt: true,
        },
      };

      await controller.save(mockReq as Request, mockRes as Response);

      expect(mockService.saveConfig).toHaveBeenCalledWith(1, {
        env: { ANTHROPIC_AUTH_TOKEN: 'test-token' },
        skipDangerousModePermissionPrompt: true,
      });
      expect(jsonMock).toHaveBeenCalledWith({ code: 0, data: { success: true } });
    });
  });

  describe('delete', () => {
    it('should delete config and return success', async () => {
      mockReq.userId = 1;

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockService.deleteConfig).toHaveBeenCalledWith(1);
      expect(jsonMock).toHaveBeenCalledWith({ code: 0, data: { success: true } });
    });
  });
});
