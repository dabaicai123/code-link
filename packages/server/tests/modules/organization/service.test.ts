import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { OrganizationService } from '../../../src/modules/organization/service.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { registerCoreServiceModules } from '../../helpers/service-modules.js';
import { createSqliteDb, runMigrations } from '../../../src/db/index.js';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    const sqlite = createSqliteDb(':memory:');
    runMigrations(sqlite);
    db = DatabaseConnection.fromSqlite(sqlite);
    container.registerInstance(DatabaseConnection, db);

    registerCoreServiceModules();

    service = container.resolve(OrganizationService);
  });

  afterEach(() => {
    db.close();
    container.reset();
  });

  describe('create', () => {
    it('should create organization for admin user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      const org = await service.create(user.id, { name: 'Test Org' });

      expect(org.name).toBe('Test Org');
      expect(org.createdBy).toBe(user.id);
    });

    it('should throw ParamError for empty name', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      await expect(service.create(user.id, { name: '' }))
        .rejects.toThrow('组织名称不能为空');
    });

    it('should throw ParamError for name exceeding 100 chars', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      await expect(service.create(user.id, { name: 'a'.repeat(101) }))
        .rejects.toThrow('组织名称不能超过 100 个字符');
    });

    it('should create organization for any user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      const org = await service.create(user.id, { name: 'Test Org' });

      expect(org.name).toBe('Test Org');
      expect(org.createdBy).toBe(user.id);
    });
  });

  describe('findByUserId', () => {
    it('should return organizations for user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      await service.create(user.id, { name: 'Test Org' });

      const result = await service.findByUserId(user.id);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Org');
      expect(result.data[0].role).toBe('owner');
    });
  });

  describe('findById', () => {
    it('should return organization detail', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const org = await service.create(user.id, { name: 'Test Org' });

      const detail = await service.findById(org.id, user.id);

      expect(detail.name).toBe('Test Org');
      expect(detail.members).toHaveLength(1);
      expect(detail.members[0].role).toBe('owner');
    });

    it('should throw NotFoundError for non-existent org', async () => {
      await expect(service.findById(99999, 1))
        .rejects.toThrow('组织不存在');
    });
  });

  describe('updateName', () => {
    it('should update organization name', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const org = await service.create(user.id, { name: 'Test Org' });

      const updated = await service.updateName(org.id, user.id, { name: 'Updated Org' });

      expect(updated.name).toBe('Updated Org');
    });

    it('should throw PermissionError for non-owner', async () => {
      const authRepo = container.resolve(AuthRepository);
      const owner = await authRepo.create({ name: 'Owner', email: 'admin@test.com', passwordHash: 'hash' });
      const member = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });
      const org = await service.create(owner.id, { name: 'Test Org' });

      await expect(service.updateName(org.id, member.id, { name: 'Updated Org' }))
        .rejects.toThrow('只有组织 owner 可以修改名称');
    });
  });

  describe('delete', () => {
    it('should delete organization', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const org = await service.create(user.id, { name: 'Test Org' });

      await service.delete(org.id, user.id);

      const result = await service.findByUserId(user.id);
      expect(result.data).toHaveLength(0);
    });

    it('should throw PermissionError for non-owner', async () => {
      const authRepo = container.resolve(AuthRepository);
      const owner = await authRepo.create({ name: 'Owner', email: 'admin@test.com', passwordHash: 'hash' });
      const member = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });
      const org = await service.create(owner.id, { name: 'Test Org' });

      await expect(service.delete(org.id, member.id))
        .rejects.toThrow('只有组织 owner 可以删除组织');
    });
  });
});