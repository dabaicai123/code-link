import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { PermissionService } from '../../src/shared/permission.service.js';
import { AuthRepository } from '../../src/modules/auth/repository.js';
import { OrganizationRepository } from '../../src/modules/organization/repository.js';
import { DatabaseConnection } from '../../src/core/database/index.js';
import { resetConfig } from '../../src/core/config.js';
import { registerCoreServiceModules } from '../helpers/service-modules.js';
import { createSqliteDb, runMigrations } from '../../src/db/index.js';
import { organizationMembers } from '../../src/db/schema/index.js';

describe('PermissionService', () => {
  let service: PermissionService;
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

    service = container.resolve(PermissionService);
  });

  afterEach(() => {
    db.close();
    container.reset();
  });

  describe('requireOrgRole', () => {
    it('should pass for admin user regardless of role', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgRole(user.id, null, 'developer')).resolves.not.toThrow();
    });

    it('should throw for null role (non-member)', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgRole(user.id, null, 'member'))
        .rejects.toThrow('您不是该组织的成员');
    });

    it('should throw for insufficient role level', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgRole(user.id, 'member', 'developer'))
        .rejects.toThrow('需要 developer 或更高权限');
    });

    it('should pass for sufficient role level', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Developer', email: 'dev@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgRole(user.id, 'developer', 'member')).resolves.not.toThrow();
    });
  });

  describe('requireOrgOwner', () => {
    it('should pass for admin user regardless of role', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgOwner(user.id, null)).resolves.not.toThrow();
    });

    it('should pass for owner role', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgOwner(user.id, 'owner')).resolves.not.toThrow();
    });

    it('should throw for non-owner role', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Developer', email: 'dev@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgOwner(user.id, 'developer'))
        .rejects.toThrow('只有组织 owner 可以执行此操作');
    });

    it('should throw for null role (non-member)', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      await expect(service.requireOrgOwner(user.id, null))
        .rejects.toThrow('只有组织 owner 可以执行此操作');
    });
  });

  describe('requireProjectAccess', () => {
    it('should pass for admin user regardless of role', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      await expect(service.requireProjectAccess(user.id, null)).resolves.not.toThrow();
    });

    it('should pass for org member', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });

      await expect(service.requireProjectAccess(user.id, 'member')).resolves.not.toThrow();
    });

    it('should throw for null role (non-member)', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      await expect(service.requireProjectAccess(user.id, null))
        .rejects.toThrow('您没有权限访问该项目');
    });
  });

  describe('isSuperAdmin', () => {
    it('should return true for admin user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });

      const result = await service.isSuperAdmin(user.id);
      expect(result).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'User', email: 'user@test.com', passwordHash: 'hash' });

      const result = await service.isSuperAdmin(user.id);
      expect(result).toBe(false);
    });
  });
});