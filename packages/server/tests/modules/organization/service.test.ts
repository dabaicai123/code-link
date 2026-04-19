import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { OrganizationService } from '../../../src/modules/organization/service.js';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { initSchema } from '../../../src/db/init.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-org-service.db');

describe('OrganizationService', () => {
  let service: OrganizationService;
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
    container.registerSingleton(OrganizationService);

    service = container.resolve(OrganizationService);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
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

    it('should throw PermissionError for non-admin non-owner user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      await expect(service.create(user.id, { name: 'Test Org' }))
        .rejects.toThrow('只有组织 owner 或管理员可以创建组织');
    });
  });

  describe('findByUserId', () => {
    it('should return organizations for user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      await service.create(user.id, { name: 'Test Org' });

      const orgs = await service.findByUserId(user.id);

      expect(orgs).toHaveLength(1);
      expect(orgs[0].name).toBe('Test Org');
      expect(orgs[0].role).toBe('owner');
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

      const orgs = await service.findByUserId(user.id);
      expect(orgs).toHaveLength(0);
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