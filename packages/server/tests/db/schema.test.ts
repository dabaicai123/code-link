import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers/test-db.js';
import {
  createTestUser,
  createTestOrganization,
  createTestProject,
  findUserByEmail,
  createTestToken,
  createTestRepo,
  findTokenByUserIdAndProvider,
  findReposByProjectId,
  deleteTestUser,
  deleteTestProject,
} from '../helpers/test-db.js';
import { eq, and } from 'drizzle-orm';
import { users, projects, organizationMembers, organizations, projectTokens, projectRepos } from '../../src/db/schema/index.js';
import { container } from 'tsyringe';
import { DatabaseConnection } from '../../src/db/index.js';

function getTestDb() {
  return container.resolve(DatabaseConnection).getDb();
}

describe('Database Schema', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('should create all required tables', () => {
    const sqlite = container.resolve(DatabaseConnection).getSqlite();
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('projects');
    expect(names).toContain('builds');
    expect(names).toContain('project_tokens');
    expect(names).toContain('project_repos');
    expect(names).toContain('drafts');
    expect(names).toContain('draft_messages');
    expect(names).toContain('organizations');
    expect(names).toContain('organization_members');
  });

  it('should insert and find users', () => {
    const user = createTestUser({
      name: 'test-user',
      email: 'test@test.com',
      passwordHash: 'hash123',
    });
    expect(user.name).toBe('test-user');

    const foundUser = findUserByEmail('test@test.com');
    expect(foundUser).toBeDefined();
    expect(foundUser!.name).toBe('test-user');
  });

  it('should enforce unique email constraint', () => {
    createTestUser({ name: 'user1', email: 'dup@test.com', passwordHash: 'hash' });
    expect(() => {
      createTestUser({ name: 'user2', email: 'dup@test.com', passwordHash: 'hash' });
    }).toThrow();
  });

  it('should create project with org member association', () => {
    const user = createTestUser({ name: 'owner', email: 'owner@test.com', passwordHash: 'hash' });
    const org = createTestOrganization(user.id, { name: 'test-org' });
    const project = createTestProject(user.id, org.id, {
      name: 'test-project',
      templateType: 'node',
      status: 'created',
    });

    const db = getTestDb();
    db.insert(organizationMembers).values({
      organizationId: org.id, userId: user.id, role: 'owner', invitedBy: user.id,
    }).run();

    const member = db.select().from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id)))
      .get();
    expect(member).toBeDefined();
    expect(member!.role).toBe('owner');
  });

  it('should enforce foreign key constraints', () => {
    const user = createTestUser({ name: 'temp', email: 'temp@test.com', passwordHash: 'hash' });
    const org = createTestOrganization(user.id, { name: 'temp-org' });

    const db = getTestDb();
    expect(() => {
      db.insert(projects).values({
        name: 'proj', templateType: 'node', status: 'created',
        createdBy: 9999, organizationId: org.id,
      }).run();
    }).toThrow();
  });

  it('should cascade delete org members when org deleted', () => {
    const user = createTestUser({ name: 'user', email: 'cascade@test.com', passwordHash: 'hash' });
    const org = createTestOrganization(user.id, { name: 'test-org' });

    const db = getTestDb();
    db.insert(organizationMembers).values({
      organizationId: org.id, userId: user.id, role: 'owner', invitedBy: user.id,
    }).run();

    db.delete(organizations).where(eq(organizations.id, org.id)).run();

    const members = db.select().from(organizationMembers)
      .where(eq(organizationMembers.organizationId, org.id)).all();
    expect(members).toHaveLength(0);
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
      accessToken: 'gh_token', refreshToken: 'gh_refresh', expiresAt: '2025-01-01T00:00:00Z',
    });
    expect(() => {
      createTestToken(user.id, 'github', {
        accessToken: 'gh_token2', refreshToken: 'gh_refresh2', expiresAt: '2025-02-01T00:00:00Z',
      });
    }).toThrow();
  });

  it('should cascade delete tokens when user deleted', () => {
    const user = createTestUser();
    createTestToken(user.id, 'github', {
      accessToken: 'gh_token', refreshToken: 'gh_refresh', expiresAt: '2025-01-01T00:00:00Z',
    });
    deleteTestUser(user.id);

    const db = getTestDb();
    const token = db.select().from(projectTokens).where(eq(projectTokens.userId, user.id)).get();
    expect(token).toBeUndefined();
  });

  it('should insert and retrieve project_repo', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    createTestRepo(project.id, {
      provider: 'github', repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo', branch: 'main',
    });

    const repos = findReposByProjectId(project.id);
    expect(repos).toHaveLength(1);
    expect(repos[0].repoUrl).toBe('https://github.com/user/repo');
    expect(repos[0].provider).toBe('github');
  });

  it('should enforce unique constraint on project_id and repo_url', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    createTestRepo(project.id, {
      provider: 'github', repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo', branch: 'main',
    });
    expect(() => {
      createTestRepo(project.id, {
        provider: 'gitlab', repoUrl: 'https://github.com/user/repo',
        repoName: 'user/repo', branch: 'develop',
      });
    }).toThrow();
  });

  it('should cascade delete repos when project deleted', () => {
    const user = createTestUser();
    const org = createTestOrganization(user.id);
    const project = createTestProject(user.id, org.id);

    createTestRepo(project.id, {
      provider: 'github', repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo', branch: 'main',
    });
    deleteTestProject(project.id);

    const repos = findReposByProjectId(project.id);
    expect(repos).toHaveLength(0);
  });
});