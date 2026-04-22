// tests/modules/gitprovider/service.test.ts
import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { GitProviderService } from '../../../src/modules/gitprovider/service.js';
import { GitProviderRepository } from '../../../src/modules/gitprovider/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/db/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { setupTestDb, teardownTestDb } from '../../helpers/test-db.js';

// Mock OAuth functions
vi.mock('../../../src/modules/gitprovider/oauth.js', () => ({
  getOAuthConfig: () => ({
    githubClientId: 'test-github-id',
    githubClientSecret: 'test-github-secret',
    gitlabClientId: 'test-gitlab-id',
    gitlabClientSecret: 'test-gitlab-secret',
    gitlabBaseUrl: 'https://gitlab.com',
    redirectUri: 'http://localhost:3001/oauth/callback',
  }),
  getGitHubOAuthUrl: () => 'https://github.com/login/oauth/authorize?...',
  getGitLabOAuthUrl: () => 'https://gitlab.com/oauth/authorize?...',
  exchangeGitHubCode: vi.fn().mockResolvedValue({ access_token: 'github-test-token', expires_in: 3600 }),
  exchangeGitLabCode: vi.fn().mockResolvedValue({ access_token: 'gitlab-test-token', expires_in: 3600 }),
}));

// Mock GitHub client
vi.mock('../../../src/modules/gitprovider/github-client.js', () => ({
  GitHubClient: vi.fn().mockImplementation(() => ({
    getUserRepos: vi.fn().mockResolvedValue([{ id: 1, name: 'test-repo', full_name: 'user/test-repo' }]),
    getRepo: vi.fn().mockResolvedValue({ id: 1, name: 'test-repo' }),
    getRepoBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
    createWebhook: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com/webhook', active: true }),
  })),
}));

// Mock GitLab client
vi.mock('../../../src/modules/gitprovider/gitlab-client.js', () => ({
  GitLabClient: vi.fn().mockImplementation(() => ({
    getUserProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'test-project' }]),
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'test-project' }),
    getProjectBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
  })),
}));

describe('GitProviderService', () => {
  let service: GitProviderService;
  let db: DatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    setupTestDb();
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    container.registerSingleton(AuthRepository);
    container.registerSingleton(GitProviderRepository);
    container.registerSingleton(GitProviderService);

    db = container.resolve(DatabaseConnection);
    service = container.resolve(GitProviderService);
  });

  afterEach(() => {
    teardownTestDb();
  });

  describe('getOAuthUrl', () => {
    it('should return GitHub OAuth URL', () => {
      const url = service.getOAuthUrl('github');
      expect(url).toContain('github.com');
    });

    it('should return GitLab OAuth URL', () => {
      const url = service.getOAuthUrl('gitlab');
      expect(url).toContain('gitlab.com');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should save GitHub token after OAuth callback', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const { exchangeGitHubCode } = await import('../../../src/modules/gitprovider/oauth.js');
      await service.handleOAuthCallback('github', 'test-code', user.id);

      expect(exchangeGitHubCode).toHaveBeenCalled();
    });
  });

  describe('getAuthorizationStatus', () => {
    it('should return authorized status for user with token', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const repo = container.resolve(GitProviderRepository);
      await repo.upsert({ userId: user.id, provider: 'github', accessToken: 'test-token' });

      const status = await service.getAuthorizationStatus(user.id);

      expect(status.github.authorized).toBe(true);
      expect(status.gitlab.authorized).toBe(false);
    });
  });

  describe('revokeAuthorization', () => {
    it('should delete token', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const repo = container.resolve(GitProviderRepository);
      await repo.upsert({ userId: user.id, provider: 'github', accessToken: 'test-token' });

      await service.revokeAuthorization(user.id, 'github');

      const hasToken = await repo.hasToken(user.id, 'github');
      expect(hasToken).toBe(false);
    });
  });
});