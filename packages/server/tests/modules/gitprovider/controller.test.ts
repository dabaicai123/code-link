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
  let sendMock: ReturnType<typeof vi.fn>;

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
      getGitHubRepo: vi.fn().mockResolvedValue({ id: 1, name: 'test-repo', owner: { login: 'test-owner' } }),
      getGitHubBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
      createGitHubWebhook: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com/webhook' }),
      getGitLabProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'test-project' }]),
      getGitLabProject: vi.fn().mockResolvedValue({ id: 1, name: 'test-project' }),
      getGitLabBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
    };

    controller = new GitProviderController(mockService as GitProviderService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    sendMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('GitHub OAuth', () => {
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

    describe('getGitHubStatus', () => {
      it('should return GitHub authorization status', async () => {
        mockReq.query = { userId: '1' };

        await controller.getGitHubStatus(mockReq as Request, mockRes as Response);

        expect(mockService.getAuthorizationStatus).toHaveBeenCalledWith(1);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: { authorized: true },
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
  });

  describe('GitHub Repos', () => {
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

    describe('getGitHubRepo', () => {
      it('should return a specific GitHub repo', async () => {
        mockReq.query = { userId: '1' };
        mockReq.params = { owner: 'test-owner', repo: 'test-repo' };

        await controller.getGitHubRepo(mockReq as Request, mockRes as Response);

        expect(mockService.getGitHubRepo).toHaveBeenCalledWith(1, 'test-owner', 'test-repo');
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: { id: 1, name: 'test-repo', owner: { login: 'test-owner' } },
        });
      });
    });

    describe('getGitHubBranches', () => {
      it('should return branches for a GitHub repo', async () => {
        mockReq.query = { userId: '1' };
        mockReq.params = { owner: 'test-owner', repo: 'test-repo' };

        await controller.getGitHubBranches(mockReq as Request, mockRes as Response);

        expect(mockService.getGitHubBranches).toHaveBeenCalledWith(1, 'test-owner', 'test-repo');
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: [{ name: 'main' }],
        });
      });
    });

    describe('createGitHubWebhook', () => {
      it('should create a webhook for a GitHub repo', async () => {
        mockReq.body = { userId: 1, owner: 'test-owner', repo: 'test-repo', webhookUrl: 'https://example.com/webhook' };

        await controller.createGitHubWebhook(mockReq as Request, mockRes as Response);

        expect(mockService.createGitHubWebhook).toHaveBeenCalledWith(1, 'test-owner', 'test-repo', 'https://example.com/webhook');
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: { id: 1, url: 'https://example.com/webhook' },
        });
      });
    });
  });

  describe('GitLab OAuth', () => {
    describe('getGitLabOAuthUrl', () => {
      it('should return GitLab OAuth URL', async () => {
        (mockService.getOAuthUrl as ReturnType<typeof vi.fn>).mockReturnValueOnce('https://gitlab.com/oauth/authorize?...');

        await controller.getGitLabOAuthUrl(mockReq as Request, mockRes as Response);

        expect(mockService.getOAuthUrl).toHaveBeenCalledWith('gitlab');
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: { url: 'https://gitlab.com/oauth/authorize?...' },
        });
      });
    });

    describe('handleGitLabCallback', () => {
      it('should handle GitLab OAuth callback', async () => {
        mockReq.body = { code: 'gitlab-code', userId: 1 };

        await controller.handleGitLabCallback(mockReq as Request, mockRes as Response);

        expect(mockService.handleOAuthCallback).toHaveBeenCalledWith('gitlab', 'gitlab-code', 1);
        expect(jsonMock).toHaveBeenCalledWith({ code: 0, data: { success: true } });
      });
    });

    describe('getGitLabStatus', () => {
      it('should return GitLab authorization status', async () => {
        mockReq.query = { userId: '1' };

        await controller.getGitLabStatus(mockReq as Request, mockRes as Response);

        expect(mockService.getAuthorizationStatus).toHaveBeenCalledWith(1);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: { authorized: false },
        });
      });
    });

    describe('revokeGitLabToken', () => {
      it('should revoke GitLab token', async () => {
        mockReq.query = { userId: '1' };

        await controller.revokeGitLabToken(mockReq as Request, mockRes as Response);

        expect(mockService.revokeAuthorization).toHaveBeenCalledWith(1, 'gitlab');
        expect(statusMock).toHaveBeenCalledWith(204);
      });
    });
  });

  describe('GitLab Projects', () => {
    describe('getGitLabProjects', () => {
      it('should return GitLab projects', async () => {
        mockReq.query = { userId: '1' };

        await controller.getGitLabProjects(mockReq as Request, mockRes as Response);

        expect(mockService.getGitLabProjects).toHaveBeenCalledWith(1);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: [{ id: 1, name: 'test-project' }],
        });
      });
    });

    describe('getGitLabProject', () => {
      it('should return a specific GitLab project', async () => {
        mockReq.query = { userId: '1' };
        mockReq.params = { id: '123' };

        await controller.getGitLabProject(mockReq as Request, mockRes as Response);

        expect(mockService.getGitLabProject).toHaveBeenCalledWith(1, 123);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: { id: 1, name: 'test-project' },
        });
      });
    });

    describe('getGitLabBranches', () => {
      it('should return branches for a GitLab project', async () => {
        mockReq.query = { userId: '1' };
        mockReq.params = { id: '123' };

        await controller.getGitLabBranches(mockReq as Request, mockRes as Response);

        expect(mockService.getGitLabBranches).toHaveBeenCalledWith(1, 123);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: [{ name: 'main' }],
        });
      });
    });
  });

  describe('Combined Status', () => {
    describe('getAuthorizationStatus', () => {
      it('should return authorization status for all providers', async () => {
        mockReq.query = { userId: '1' };

        await controller.getAuthorizationStatus(mockReq as Request, mockRes as Response);

        expect(mockService.getAuthorizationStatus).toHaveBeenCalledWith(1);
        expect(jsonMock).toHaveBeenCalledWith({
          code: 0,
          data: {
            github: { provider: 'github', authorized: true },
            gitlab: { provider: 'gitlab', authorized: false },
          },
        });
      });
    });
  });
});
