import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { ProjectRepository } from '../src/modules/project/repository.js';
import { BuildRepository } from '../src/modules/build/repository.js';
import { DraftRepository } from '../src/modules/draft/repository.js';
import { OrganizationRepository } from '../src/modules/organization/repository.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { DatabaseConnection } from '../src/core/database/connection.js';
import { resetConfig } from '../src/core/config.js';
import { runMigrations } from '../src/db/migrate-runner.js';
import { PAGINATION_LIMITS } from '../src/core/database/constants.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-pagination.db');

describe('Repository Pagination Limits', () => {
  let projectRepo: ProjectRepository;
  let buildRepo: BuildRepository;
  let draftRepo: DraftRepository;
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
    projectRepo = new ProjectRepository(db);
    buildRepo = new BuildRepository(db);
    draftRepo = new DraftRepository(db);
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

  // Helper function to setup test data: user, org, project
  async function setupTestData() {
    const user = await userRepo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });
    const org = await orgRepo.createWithOwner('Test Org', user.id);
    const project = await projectRepo.create({
      name: 'Test Project',
      templateType: 'node',
      organizationId: org.id,
      createdBy: user.id,
    });
    return { user, org, project };
  }

  describe('ProjectRepository.findByUserId', () => {
    it('should limit results to max 100 even when more exist', async () => {
      const { user, org } = await setupTestData();

      // Create more than max limit projects
      const maxLimit = PAGINATION_LIMITS.projects.max;
      const createCount = maxLimit + 10; // 110 projects

      for (let i = 0; i < createCount; i++) {
        await projectRepo.create({
          name: `Project ${i}`,
          templateType: 'node',
          organizationId: org.id,
          createdBy: user.id,
        });
      }

      const projects = await projectRepo.findByUserId(user.id);
      expect(projects.length).toBeLessThanOrEqual(maxLimit);
      expect(projects.length).toBe(maxLimit); // Should cap at max
    });

    it('should respect explicit limit parameter', async () => {
      const { user, org } = await setupTestData();

      // Create 20 projects
      for (let i = 0; i < 20; i++) {
        await projectRepo.create({
          name: `Project ${i}`,
          templateType: 'node',
          organizationId: org.id,
          createdBy: user.id,
        });
      }

      // Request limit of 10
      const projects = await projectRepo.findByUserId(user.id, undefined, 10);
      expect(projects.length).toBe(10);
    });

    it('should cap limit parameter to max 100', async () => {
      const { user, org } = await setupTestData();

      const maxLimit = PAGINATION_LIMITS.projects.max;

      // Create more than max limit projects
      for (let i = 0; i < maxLimit + 10; i++) {
        await projectRepo.create({
          name: `Project ${i}`,
          templateType: 'node',
          organizationId: org.id,
          createdBy: user.id,
        });
      }

      // Request limit exceeding max
      const projects = await projectRepo.findByUserId(user.id, undefined, 500);
      expect(projects.length).toBe(maxLimit); // Should be capped at max
    });
  });

  describe('BuildRepository.findByProjectId', () => {
    it('should limit results to max 50 even when more exist', async () => {
      const { project } = await setupTestData();

      // Create more than max limit builds
      const maxLimit = PAGINATION_LIMITS.builds.max;
      const createCount = maxLimit + 10; // 60 builds

      for (let i = 0; i < createCount; i++) {
        await buildRepo.create({ projectId: project.id });
      }

      const builds = await buildRepo.findByProjectId(project.id);
      expect(builds.length).toBeLessThanOrEqual(maxLimit);
      expect(builds.length).toBe(maxLimit); // Should cap at max
    });

    it('should respect explicit limit parameter', async () => {
      const { project } = await setupTestData();

      // Create 30 builds
      for (let i = 0; i < 30; i++) {
        await buildRepo.create({ projectId: project.id });
      }

      // Request limit of 15
      const builds = await buildRepo.findByProjectId(project.id, 15);
      expect(builds.length).toBe(15);
    });

    it('should cap limit parameter to max 50', async () => {
      const { project } = await setupTestData();

      const maxLimit = PAGINATION_LIMITS.builds.max;

      // Create more than max limit builds
      for (let i = 0; i < maxLimit + 10; i++) {
        await buildRepo.create({ projectId: project.id });
      }

      // Request limit exceeding max
      const builds = await buildRepo.findByProjectId(project.id, 100);
      expect(builds.length).toBe(maxLimit); // Should be capped at max
    });
  });

  describe('DraftRepository.findMessages', () => {
    it('should limit results to max 200 even when more exist', async () => {
      const { user, project } = await setupTestData();

      const draft = await draftRepo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      // Create more than max limit messages
      const maxLimit = PAGINATION_LIMITS.messages.max;
      const createCount = maxLimit + 10; // 210 messages

      for (let i = 0; i < createCount; i++) {
        await draftRepo.createMessage({
          draftId: draft.id,
          userId: user.id,
          content: `Message ${i}`,
          messageType: 'text',
        });
      }

      const messages = await draftRepo.findMessages(draft.id);
      expect(messages.length).toBeLessThanOrEqual(maxLimit);
      expect(messages.length).toBe(maxLimit); // Should cap at max
    });

    it('should respect explicit limit parameter', async () => {
      const { user, project } = await setupTestData();

      const draft = await draftRepo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      // Create 150 messages
      for (let i = 0; i < 150; i++) {
        await draftRepo.createMessage({
          draftId: draft.id,
          userId: user.id,
          content: `Message ${i}`,
          messageType: 'text',
        });
      }

      // Request limit of 50
      const messages = await draftRepo.findMessages(draft.id, 50);
      expect(messages.length).toBe(50);
    });

    it('should cap limit parameter to max 200', async () => {
      const { user, project } = await setupTestData();

      const draft = await draftRepo.create({
        projectId: project.id,
        title: 'Test Draft',
        createdBy: user.id,
      });

      const maxLimit = PAGINATION_LIMITS.messages.max;

      // Create more than max limit messages
      for (let i = 0; i < maxLimit + 10; i++) {
        await draftRepo.createMessage({
          draftId: draft.id,
          userId: user.id,
          content: `Message ${i}`,
          messageType: 'text',
        });
      }

      // Request limit exceeding max
      const messages = await draftRepo.findMessages(draft.id, 500);
      expect(messages.length).toBe(maxLimit); // Should be capped at max
    });
  });
});
