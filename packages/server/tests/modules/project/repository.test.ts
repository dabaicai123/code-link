import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { ProjectRepository } from '../../../src/modules/project/repository.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { runMigrations } from '../../../src/db/migrate-runner.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-project-repo.db');

describe('ProjectRepository', () => {
  let repo: ProjectRepository;
  let orgRepo: OrganizationRepository;
  let userRepo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    runMigrations(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    repo = new ProjectRepository(db);
    orgRepo = new OrganizationRepository(db);
    userRepo = new AuthRepository(db);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('create', () => {
    it('should create project', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await repo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.templateType).toBe('node');
    });
  });

  describe('findById', () => {
    it('should return project by id', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await repo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      const found = await repo.findById(project.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Project');
    });

    it('should return undefined for non-existent project', async () => {
      const found = await repo.findById(99999);
      expect(found).toBeUndefined();
    });
  });

  describe('findByUserId', () => {
    it('should return projects for user', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      await repo.create({ name: 'Project 1', templateType: 'node', organizationId: org.id, createdBy: user.id });
      await repo.create({ name: 'Project 2', templateType: 'node', organizationId: org.id, createdBy: user.id });

      const projects = await repo.findByUserId(user.id);
      expect(projects).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete project', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const project = await repo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      await repo.delete(project.id);

      const found = await repo.findById(project.id);
      expect(found).toBeUndefined();
    });
  });
});