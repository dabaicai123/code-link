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
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-project-service.db');

describe('ProjectService', () => {
  let service: ProjectService;
  let db: DatabaseConnection;

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
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('create', () => {
    it('should create project for admin user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);

      const project = await service.create(user.id, { name: 'Test Project', templateType: 'node', organizationId: org.id });

      expect(project.name).toBe('Test Project');
      expect(project.templateType).toBe('node');
    });

    it('should throw ParamError for empty name', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);

      await expect(service.create(user.id, { name: '', templateType: 'node', organizationId: org.id }))
        .rejects.toThrow('项目名称必须是 1-100 字符');
    });
  });

  describe('findByUserId', () => {
    it('should return projects for user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      await service.create(user.id, { name: 'Project 1', templateType: 'node', organizationId: org.id });

      const projects = await service.findByUserId(user.id);

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Project 1');
    });
  });

  describe('findById', () => {
    it('should return project detail', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await service.create(user.id, { name: 'Test Project', templateType: 'node', organizationId: org.id });

      const detail = await service.findById(user.id, project.id);

      expect(detail.name).toBe('Test Project');
      expect(detail.members).toHaveLength(1);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(service.findById(1, 99999))
        .rejects.toThrow('项目不存在');
    });
  });

  describe('delete', () => {
    it('should delete project for owner', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await service.create(user.id, { name: 'Test Project', templateType: 'node', organizationId: org.id });

      await service.delete(user.id, project.id);

      const projects = await service.findByUserId(user.id);
      expect(projects).toHaveLength(0);
    });
  });

  describe('parseRepoUrl', () => {
    it('should parse GitHub URL', () => {
      const result = service.parseRepoUrl('https://github.com/owner/repo');
      expect(result).toEqual({ provider: 'github', repoName: 'owner/repo' });
    });

    it('should parse GitLab URL', () => {
      const result = service.parseRepoUrl('https://gitlab.com/owner/repo');
      expect(result).toEqual({ provider: 'gitlab', repoName: 'owner/repo' });
    });

    it('should return null for invalid URL', () => {
      expect(service.parseRepoUrl('invalid-url')).toBeNull();
    });

    it('should return null for unsupported host', () => {
      expect(service.parseRepoUrl('https://bitbucket.org/owner/repo')).toBeNull();
    });
  });
});