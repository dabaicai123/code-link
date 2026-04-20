import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { projectTokens, projectRepos, projects } from '../src/db/schema/index.js';
import {
  createTestUser,
  createTestOrganization,
  createTestProject,
  createTestToken,
  createTestRepo,
  findTokenByUserIdAndProvider,
  findReposByProjectId,
  deleteTestUser,
  deleteTestProject,
  setupTestDb,
  teardownTestDb,
} from './helpers/test-db.js';
import { container } from 'tsyringe';
import { DatabaseConnection } from '../src/db/index.js';

function getTestDb() {
  return container.resolve(DatabaseConnection).getDb();
}

describe('Project Tokens Schema', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('should have project_tokens table', () => {
    const sqlite = container.resolve(DatabaseConnection).getSqlite();
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    expect(tables.some(t => t.name === 'project_tokens')).toBe(true);
  });

  it('should have project_repos table', () => {
    const sqlite = container.resolve(DatabaseConnection).getSqlite();
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    expect(tables.some(t => t.name === 'project_repos')).toBe(true);
  });

  it('should insert and retrieve token', () => {
    const user = createTestUser();
    createTestToken(user.id, 'github', {
      accessToken: 'gh_token',
      refreshToken: 'gh_refresh',
      expiresAt: '2025-01-01T00:00:00Z',
    });

    const token = findTokenByUserIdAndProvider(user.id, 'github');
    expect(token).toBeDefined();
    expect(token!.accessToken).toBe('gh_token');
    expect(token!.provider).toBe('github');
  });

  it('should enforce unique constraint on user_id and provider', () => {
    const user = createTestUser();
    createTestToken(user.id, 'github', {
      accessToken: 'gh_token',
      refreshToken: 'gh_refresh',
      expiresAt: '2025-01-01T00:00:00Z',
    });

    // Should fail due to unique constraint
    expect(() => {
      createTestToken(user.id, 'github', {
        accessToken: 'gh_token2',
        refreshToken: 'gh_refresh2',
        expiresAt: '2025-02-01T00:00:00Z',
      });
    }).toThrow();
  });

  it('should cascade delete tokens when user is deleted', () => {
    const user = createTestUser();
    createTestToken(user.id, 'github', {
      accessToken: 'gh_token',
      refreshToken: 'gh_refresh',
      expiresAt: '2025-01-01T00:00:00Z',
    });

    // Delete user
    deleteTestUser(user.id);

    // Token should be deleted
    const drizzleDb = getTestDb();
    const token = drizzleDb
      .select()
      .from(projectTokens)
      .where(eq(projectTokens.userId, user.id))
      .get();
    expect(token).toBeUndefined();
  });

  it('should insert and retrieve project_repo', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    createTestRepo(project.id, {
      provider: 'github',
      repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo',
      branch: 'main',
    });

    const repos = findReposByProjectId(project.id);
    expect(repos).toHaveLength(1);
    expect(repos[0].repoUrl).toBe('https://github.com/user/repo');
    expect(repos[0].repoName).toBe('user/repo');
    expect(repos[0].provider).toBe('github');
    expect(repos[0].branch).toBe('main');
  });

  it('should enforce unique constraint on project_id and repo_url', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    createTestRepo(project.id, {
      provider: 'github',
      repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo',
      branch: 'main',
    });

    // Should fail due to unique constraint (same project_id and repo_url)
    expect(() => {
      createTestRepo(project.id, {
        provider: 'gitlab',
        repoUrl: 'https://github.com/user/repo',
        repoName: 'user/repo',
        branch: 'develop',
      });
    }).toThrow();
  });

  it('should cascade delete project_repos when project is deleted', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    createTestRepo(project.id, {
      provider: 'github',
      repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo',
      branch: 'main',
    });

    // Delete project
    deleteTestProject(project.id);

    // project_repo should be deleted via CASCADE
    const repos = findReposByProjectId(project.id);
    expect(repos).toHaveLength(0);
  });

  it('should only accept valid provider values for project_tokens', () => {
    const user = createTestUser();

    // Invalid provider should fail - using direct ORM with type assertion to bypass TypeScript
    expect(() => {
      const drizzleDb = getTestDb();
      drizzleDb.insert(projectTokens).values({
        userId: user.id,
        provider: 'invalid_provider' as 'github' | 'gitlab',
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2025-01-01T00:00:00Z',
      }).run();
    }).toThrow();
  });

  it('should only accept valid provider values for project_repos', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    // Invalid provider should fail - using direct ORM with type assertion to bypass TypeScript
    expect(() => {
      const drizzleDb = getTestDb();
      drizzleDb.insert(projectRepos).values({
        projectId: project.id,
        provider: 'invalid_provider' as 'github' | 'gitlab',
        repoUrl: 'https://example.com/repo',
        repoName: 'repo',
        branch: 'main',
      }).run();
    }).toThrow();
  });
});