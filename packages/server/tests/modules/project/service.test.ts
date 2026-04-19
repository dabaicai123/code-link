import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { ProjectService } from '../../../src/modules/project/service.js';
import { ProjectRepository } from '../../../src/modules/project/repository.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { PermissionService } from '../../../src/shared/permission.service.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { initSchema } from '../../../src/db/init.js';
import { organizationMembers } from '../../../src/db/schema/index.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-project-service.db');

describe('ProjectService', () => {
  let service: ProjectService;
  let db: DatabaseConnection;
  let authRepo: AuthRepository;
  let orgRepo: OrganizationRepository;
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    db = new DatabaseConnection(TEST_DB_PATH);
    initSchema(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    container.registerSingleton(AuthRepository);
    container.registerSingleton(OrganizationRepository);
    container.registerSingleton(ProjectRepository);
    container.registerSingleton(PermissionService);
    container.registerSingleton(ProjectService);

    service = container.resolve(ProjectService);
    authRepo = container.resolve(AuthRepository);
    orgRepo = container.resolve(OrganizationRepository);
    projectRepo = container.resolve(ProjectRepository);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  // Helper to create test data
  async function createTestData() {
    const admin = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
    const org = await orgRepo.createWithOwner('Test Org', admin.id);
    return { admin, org };
  }

  async function addMember(orgId: number, userId: number, role: 'owner' | 'developer' | 'member', inviterId: number) {
    db.getDb().insert(organizationMembers).values({
      organizationId: orgId,
      userId: userId,
      role: role,
      invitedBy: inviterId,
    }).run();
  }

  describe('create', () => {
    it('should create project for admin user', async () => {
      const { admin, org } = await createTestData();

      const project = await service.create(admin.id, {
        name: 'Test Project',
        templateType: 'node',
        organizationId: org.id,
      });

      expect(project.name).toBe('Test Project');
      expect(project.templateType).toBe('node');
      expect(project.organizationId).toBe(org.id);
      expect(project.createdBy).toBe(admin.id);
    });

    it('should create project for developer', async () => {
      const { admin, org } = await createTestData();
      const developer = await authRepo.create({ name: 'Dev', email: 'dev@test.com', passwordHash: 'hash' });
      await addMember(org.id, developer.id, 'developer', admin.id);

      const project = await service.create(developer.id, {
        name: 'Dev Project',
        templateType: 'node+java',
        organizationId: org.id,
      });

      expect(project.name).toBe('Dev Project');
      expect(project.createdBy).toBe(developer.id);
    });

    it('should throw ParamError for empty name', async () => {
      const { admin, org } = await createTestData();

      await expect(service.create(admin.id, {
        name: '',
        templateType: 'node',
        organizationId: org.id,
      })).rejects.toThrow('项目名称不能为空');
    });

    it('should throw ParamError for name exceeding 100 chars', async () => {
      const { admin, org } = await createTestData();

      await expect(service.create(admin.id, {
        name: 'a'.repeat(101),
        templateType: 'node',
        organizationId: org.id,
      })).rejects.toThrow('项目名称不能超过 100 个字符');
    });

    it('should throw ParamError for invalid templateType', async () => {
      const { admin, org } = await createTestData();

      await expect(service.create(admin.id, {
        name: 'Project',
        templateType: 'invalid' as any,
        organizationId: org.id,
      })).rejects.toThrow('无效的模板类型');
    });

    it('should throw PermissionError for member (insufficient role)', async () => {
      const { admin, org } = await createTestData();
      const member = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });
      await addMember(org.id, member.id, 'member', admin.id);

      await expect(service.create(member.id, {
        name: 'Project',
        templateType: 'node',
        organizationId: org.id,
      })).rejects.toThrow('需要 developer 或更高权限');
    });

    it('should throw PermissionError for non-member', async () => {
      const { org } = await createTestData();
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.create(outsider.id, {
        name: 'Project',
        templateType: 'node',
        organizationId: org.id,
      })).rejects.toThrow('您不是该组织的成员');
    });
  });

  describe('findByUserId', () => {
    it('should return projects for user', async () => {
      const { admin, org } = await createTestData();
      await projectRepo.create({ name: 'Project 1', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      await projectRepo.create({ name: 'Project 2', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      const projects = await service.findByUserId(admin.id);

      expect(projects).toHaveLength(2);
    });

    it('should return empty array for user with no projects', async () => {
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      const projects = await service.findByUserId(user.id);

      expect(projects).toHaveLength(0);
    });

    it('should filter by organizationId', async () => {
      const { admin, org } = await createTestData();
      const org2 = await orgRepo.createWithOwner('Org 2', admin.id);
      await projectRepo.create({ name: 'Project 1', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      await projectRepo.create({ name: 'Project 2', templateType: 'node', organizationId: org2.id, createdBy: admin.id });

      const projects = await service.findByUserId(admin.id, org.id);

      expect(projects).toHaveLength(1);
      expect(projects[0].organizationId).toBe(org.id);
    });
  });

  describe('findById', () => {
    it('should return project detail for org member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      const detail = await service.findById(admin.id, project.id);

      expect(detail.name).toBe('Test Project');
      expect(detail.members).toBeDefined();
      expect(detail.members.length).toBeGreaterThan(0);
      expect(detail.repos).toBeDefined();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(service.findById(1, 99999))
        .rejects.toThrow('项目不存在');
    });

    it('should throw PermissionError for non-member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.findById(outsider.id, project.id))
        .rejects.toThrow('您没有权限访问该项目');
    });
  });

  describe('delete', () => {
    it('should delete project for owner', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      await service.delete(admin.id, project.id);

      const found = await projectRepo.findById(project.id);
      expect(found).toBeUndefined();
    });

    it('should delete project for super admin', async () => {
      const { admin, org } = await createTestData();
      const owner = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });
      await addMember(org.id, owner.id, 'owner', admin.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: owner.id });

      // admin@test.com is configured as ADMIN_EMAIL, so admin user has super admin privileges
      await service.delete(admin.id, project.id);

      const found = await projectRepo.findById(project.id);
      expect(found).toBeUndefined();
    });

    it('should throw PermissionError for developer', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const developer = await authRepo.create({ name: 'Dev', email: 'dev@test.com', passwordHash: 'hash' });
      await addMember(org.id, developer.id, 'developer', admin.id);

      await expect(service.delete(developer.id, project.id))
        .rejects.toThrow('只有组织 owner 可以执行此操作');
    });
  });

  describe('parseRepoUrl', () => {
    it('should parse GitHub URL', () => {
      const result = service.parseRepoUrl('https://github.com/owner/repo');

      expect(result).toEqual({
        provider: 'github',
        repoName: 'owner/repo',
      });
    });

    it('should parse GitHub URL with .git suffix', () => {
      const result = service.parseRepoUrl('https://github.com/owner/repo.git');

      expect(result).toEqual({
        provider: 'github',
        repoName: 'owner/repo',
      });
    });

    it('should parse GitLab URL', () => {
      const result = service.parseRepoUrl('https://gitlab.com/owner/repo');

      expect(result).toEqual({
        provider: 'gitlab',
        repoName: 'owner/repo',
      });
    });

    it('should parse self-hosted GitLab URL', () => {
      const result = service.parseRepoUrl('https://gitlab.example.com/owner/repo');

      expect(result?.provider).toBe('gitlab');
      expect(result?.repoName).toBe('owner/repo');
    });

    it('should return null for invalid URL', () => {
      expect(service.parseRepoUrl('not-a-url')).toBeNull();
    });

    it('should return null for unsupported provider', () => {
      expect(service.parseRepoUrl('https://bitbucket.org/owner/repo')).toBeNull();
    });

    it('should return null for URL without repo path', () => {
      expect(service.parseRepoUrl('https://github.com/owner')).toBeNull();
    });
  });

  describe('isProjectMember', () => {
    it('should return true for org member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      const isMember = await service.isProjectMember(project.id, admin.id);

      expect(isMember).toBe(true);
    });

    it('should return false for non-member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      const isMember = await service.isProjectMember(project.id, outsider.id);

      expect(isMember).toBe(false);
    });

    it('should return true for super admin', async () => {
      const { org } = await createTestData();
      const owner = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });
      await addMember(org.id, owner.id, 'owner', 1);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: owner.id });

      const isMember = await service.isProjectMember(project.id, 1); // admin@test.com user

      expect(isMember).toBe(true);
    });
  });

  describe('findRepos', () => {
    it('should return repos for project', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      await projectRepo.addRepo({ projectId: project.id, provider: 'github', repoUrl: 'https://github.com/owner/repo', repoName: 'owner/repo' });

      const repos = await service.findRepos(project.id, admin.id);

      expect(repos).toHaveLength(1);
      expect(repos[0].repoName).toBe('owner/repo');
    });

    it('should throw PermissionError for non-member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.findRepos(project.id, outsider.id))
        .rejects.toThrow('您没有权限访问该项目');
    });
  });

  describe('addRepo', () => {
    it('should add repo to project', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      const repo = await service.addRepo(project.id, admin.id, { url: 'https://github.com/owner/repo' });

      expect(repo.provider).toBe('github');
      expect(repo.repoName).toBe('owner/repo');
      expect(repo.repoUrl).toBe('https://github.com/owner/repo');
    });

    it('should throw ParamError for invalid URL', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      await expect(service.addRepo(project.id, admin.id, { url: 'invalid-url' }))
        .rejects.toThrow('无效的仓库 URL');
    });

    it('should throw ParamError for unsupported provider', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      await expect(service.addRepo(project.id, admin.id, { url: 'https://bitbucket.org/owner/repo' }))
        .rejects.toThrow('无效的仓库 URL');
    });

    it('should throw ConflictError for duplicate repo', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      await service.addRepo(project.id, admin.id, { url: 'https://github.com/owner/repo' });

      await expect(service.addRepo(project.id, admin.id, { url: 'https://github.com/owner/repo' }))
        .rejects.toThrow('该仓库已添加到项目中');
    });

    it('should throw PermissionError for non-member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.addRepo(project.id, outsider.id, { url: 'https://github.com/owner/repo' }))
        .rejects.toThrow('您没有权限访问该项目');
    });
  });

  describe('deleteRepo', () => {
    it('should delete repo from project', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const repo = await projectRepo.addRepo({ projectId: project.id, provider: 'github', repoUrl: 'https://github.com/owner/repo', repoName: 'owner/repo' });

      await service.deleteRepo(project.id, admin.id, repo.id);

      const repos = await projectRepo.findRepos(project.id);
      expect(repos).toHaveLength(0);
    });

    it('should throw NotFoundError for non-existent repo', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });

      await expect(service.deleteRepo(project.id, admin.id, 99999))
        .rejects.toThrow('仓库不存在');
    });

    it('should throw NotFoundError for repo from different project', async () => {
      const { admin, org } = await createTestData();
      const project1 = await projectRepo.create({ name: 'Project 1', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const project2 = await projectRepo.create({ name: 'Project 2', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const repo = await projectRepo.addRepo({ projectId: project1.id, provider: 'github', repoUrl: 'https://github.com/owner/repo', repoName: 'owner/repo' });

      await expect(service.deleteRepo(project2.id, admin.id, repo.id))
        .rejects.toThrow('仓库不存在');
    });

    it('should throw PermissionError for non-member', async () => {
      const { admin, org } = await createTestData();
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: admin.id });
      const repo = await projectRepo.addRepo({ projectId: project.id, provider: 'github', repoUrl: 'https://github.com/owner/repo', repoName: 'owner/repo' });
      const outsider = await authRepo.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash' });

      await expect(service.deleteRepo(project.id, outsider.id, repo.id))
        .rejects.toThrow('您没有权限访问该项目');
    });
  });
});