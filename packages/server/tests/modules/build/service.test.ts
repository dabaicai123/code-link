import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { BuildService } from '../../../src/modules/build/service.js';
import { BuildRepository } from '../../../src/modules/build/repository.js';
import { ProjectRepository } from '../../../src/modules/project/repository.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { PermissionService } from '../../../src/shared/permission.service.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { initSchema } from '../../../src/db/init.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-build-service.db');

// Mock external services
const mockBuildManager = {
  createBuild: vi.fn(),
  startBuild: vi.fn(),
  getProjectBuilds: vi.fn(),
  getBuild: vi.fn(),
};

const mockPreviewManager = {
  getContainerInfo: vi.fn(),
  getPreviewUrl: vi.fn(),
  stopPreviewContainer: vi.fn(),
};

vi.mock('../../../src/build/build-manager.js', () => ({
  getBuildManager: () => mockBuildManager,
}));

vi.mock('../../../src/build/preview-container.js', () => ({
  getPreviewContainerManager: () => mockPreviewManager,
}));

describe('BuildService', () => {
  let service: BuildService;
  let db: DatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();
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
    container.registerSingleton(BuildRepository);
    container.registerSingleton(PermissionService);
    container.registerSingleton(BuildService);

    service = container.resolve(BuildService);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('create', () => {
    it('should create build for admin user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const projectRepo = container.resolve(ProjectRepository);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      mockBuildManager.createBuild.mockResolvedValue({ id: 1, projectId: project.id, status: 'pending' });
      mockBuildManager.startBuild.mockResolvedValue(undefined);

      const build = await service.create(user.id, { projectId: project.id });

      expect(build.projectId).toBe(project.id);
      expect(mockBuildManager.startBuild).toHaveBeenCalled();
    });
  });

  describe('findByProjectId', () => {
    it('should return builds for project', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const projectRepo = container.resolve(ProjectRepository);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      mockBuildManager.getProjectBuilds.mockResolvedValue([
        { id: 1, projectId: project.id, status: 'success', previewPort: 3000, createdAt: '2026-01-01' },
      ]);

      const builds = await service.findByProjectId(user.id, project.id);

      expect(builds).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return build detail', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const projectRepo = container.resolve(ProjectRepository);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      mockBuildManager.getBuild.mockResolvedValue({ id: 1, projectId: project.id, status: 'success', previewPort: 3000, createdAt: '2026-01-01' });

      const build = await service.findById(user.id, 1);

      expect(build.id).toBe(1);
    });
  });

  describe('getPreview', () => {
    it('should return preview info', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const projectRepo = container.resolve(ProjectRepository);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      mockPreviewManager.getContainerInfo.mockReturnValue({ port: 3000 });
      mockPreviewManager.getPreviewUrl.mockReturnValue('http://localhost:3000');

      const preview = await service.getPreview(user.id, project.id);

      expect(preview.url).toBe('http://localhost:3000');
      expect(preview.port).toBe(3000);
    });
  });

  describe('stopPreview', () => {
    it('should stop preview container', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const projectRepo = container.resolve(ProjectRepository);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      mockPreviewManager.stopPreviewContainer.mockResolvedValue(undefined);

      await service.stopPreview(user.id, project.id);

      expect(mockPreviewManager.stopPreviewContainer).toHaveBeenCalledWith(project.id.toString());
    });
  });
});
