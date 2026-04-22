import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { BuildRepository } from '../../../src/modules/build/repository.js';
import { ProjectRepository } from '../../../src/modules/project/repository.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/db/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { setupTestDb, teardownTestDb } from '../../helpers/test-db.js';

describe('BuildRepository', () => {
  let repo: BuildRepository;
  let projectRepo: ProjectRepository;
  let orgRepo: OrganizationRepository;
  let userRepo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    setupTestDb();
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    db = container.resolve(DatabaseConnection);
    repo = new BuildRepository(db);
    projectRepo = new ProjectRepository(db);
    orgRepo = new OrganizationRepository(db);
    userRepo = new AuthRepository(db);
  });

  afterEach(() => {
    teardownTestDb();
  });

  describe('create', () => {
    it('should create build', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      const build = await repo.create({ projectId: project.id });

      expect(build.id).toBeDefined();
      expect(build.projectId).toBe(project.id);
      expect(build.status).toBe('pending');
    });
  });

  describe('findById', () => {
    it('should return build by id', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });
      const build = await repo.create({ projectId: project.id });

      const found = await repo.findById(build.id);
      expect(found).toBeDefined();
      expect(found?.projectId).toBe(project.id);
    });

    it('should return undefined for non-existent build', async () => {
      const found = await repo.findById(99999);
      expect(found).toBeUndefined();
    });
  });

  describe('findByProjectId', () => {
    it('should return builds for project', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });
      await repo.create({ projectId: project.id });
      await repo.create({ projectId: project.id });

      const builds = await repo.findByProjectId(project.id);
      expect(builds.data).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('should update build status', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });
      const build = await repo.create({ projectId: project.id });

      const updated = await repo.updateStatus(build.id, 'running');
      expect(updated.status).toBe('running');
    });

    it('should update build status with preview port', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });
      const build = await repo.create({ projectId: project.id });

      const updated = await repo.updateStatus(build.id, 'success', 3000);
      expect(updated.status).toBe('success');
      expect(updated.previewPort).toBe(3000);
    });
  });

  describe('findLatestByProjectId', () => {
    it('should return latest build for project', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });
      await repo.create({ projectId: project.id });
      const latestBuild = await repo.create({ projectId: project.id });

      const found = await repo.findLatestByProjectId(project.id);
      expect(found?.id).toBe(latestBuild.id);
    });
  });
});