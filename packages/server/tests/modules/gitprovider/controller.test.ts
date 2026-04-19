// tests/modules/gitprovider/controller.test.ts
import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { GitProviderController } from '../../../src/modules/gitprovider/controller.js';
import { GitProviderService } from '../../../src/modules/gitprovider/service.js';

describe('GitProviderController', () => {
  let controller: GitProviderController;
  let mockService: Partial<GitProviderService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      getOAuthUrl: vi.fn().mockReturnValue('https://github.com/login/oauth/authorize?...'),
      handleOAuthCallback: vi.fn(),
      getAuthorizationStatus: vi.fn().mockResolvedValue({
        github: { provider: 'github', authorized: true },
        gitlab: { provider: 'gitlab', authorized: false },
      }),
      revokeAuthorization: vi.fn(),
      getGitHubRepos: vi.fn().mockResolvedValue([{ id: 1, name: 'test-repo' }]),
      getGitHubRepo: vi.fn().mockResolvedValue({ id: 1, name: 'test-repo' }),
      getGitHubBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
      createGitHubWebhook: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com/webhook' }),
      getGitLabProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'test-project' }]),
      getGitLabProject: vi.fn().mockResolvedValue({ id: 1, name: 'test-project' }),
      getGitLabBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
    };

    controller = new GitProviderController(mockService as GitProviderService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: vi.fn() });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('getGitHubOAuthUrl', () => {
    it('should return GitHub OAuth URL', async () => {
      await controller.getGitHubOAuthUrl(mockReq as Request, mockRes as Response);

      expect(mockService.getOAuthUrl).toHaveBeenCalledWith('github');
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { url: 'https://github.com/login/oauth/authorize?...' },
      });
    });
  });

  describe('handleGitHubCallback', () => {
    it('should handle GitHub OAuth callback', async () => {
      mockReq.body = { code: 'test-code', userId: 1 };

      await controller.handleGitHubCallback(mockReq as Request, mockRes as Response);

      expect(mockService.handleOAuthCallback).toHaveBeenCalledWith('github', 'test-code', 1);
      expect(jsonMock).toHaveBeenCalledWith({ code: 0, data: { success: true } });
    });
  });

  describe('getGitHubRepos', () => {
    it('should return GitHub repos', async () => {
      mockReq.query = { userId: '1' };

      await controller.getGitHubRepos(mockReq as Request, mockRes as Response);

      expect(mockService.getGitHubRepos).toHaveBeenCalledWith(1);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: [{ id: 1, name: 'test-repo' }],
      });
    });
  });

  describe('revokeGitHubToken', () => {
    it('should revoke GitHub token', async () => {
      mockReq.query = { userId: '1' };

      await controller.revokeGitHubToken(mockReq as Request, mockRes as Response);

      expect(mockService.revokeAuthorization).toHaveBeenCalledWith(1, 'github');
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });

  describe('getAuthorizationStatus', () => {
    it('should return authorization status', async () => {
      mockReq.query = { userId: '1' };

      await controller.getAuthorizationStatus(mockReq as Request, mockRes as Response);

      expect(mockService.getAuthorizationStatus).toHaveBeenCalledWith(1);
    });
  });
});
