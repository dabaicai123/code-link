import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { PermissionService } from '../../src/shared/permission.service.js';
import { OrganizationRepository } from '../../src/modules/organization/repository.js';
import { AuthRepository } from '../../src/modules/auth/repository.js';
import { ProjectRepository } from '../../src/modules/project/repository.js';
import { DatabaseConnection } from '../../src/core/database/connection.js';
import { resetConfig } from '../../src/core/config.js';
import { initSchema } from '../../src/db/init.js';
import { organizationMembers } from '../../src/db/schema/index.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-permission.db');

describe('PermissionService', () => {
  let service: PermissionService;
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

    service = container.resolve(PermissionService);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('checkOrgRole', () => {
    it('should pass for admin user', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);

      await expect(service.checkOrgRole(user.id, org.id, 'developer')).resolves.not.toThrow();
    });

    it('should throw for non-member', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user1 = await authRepo.create({ name: 'User1', email: 'user1@test.com', passwordHash: 'hash' });
      const user2 = await authRepo.create({ name: 'User2', email: 'user2@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user1.id);

      await expect(service.checkOrgRole(user2.id, org.id, 'member'))
        .rejects.toThrow('您不是该组织的成员');
    });

    it('should throw for insufficient role level', async () => {
      const authRepo = container.resolve(AuthRepository);
      const owner = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });
      const memberUser = await authRepo.create({ name: 'Member', email: 'member@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', owner.id);

      // Add member directly to database
      db.getDb().insert(organizationMembers).values({
        organizationId: org.id,
        userId: memberUser.id,
        role: 'member',
        invitedBy: owner.id,
      }).run();

      await expect(service.checkOrgRole(memberUser.id, org.id, 'developer'))
        .rejects.toThrow('需要 developer 或更高权限');
    });
  });

  describe('checkOrgOwner', () => {
    it('should pass for owner', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);

      await expect(service.checkOrgOwner(user.id, org.id)).resolves.not.toThrow();
    });

    it('should throw for non-owner', async () => {
      const authRepo = container.resolve(AuthRepository);
      const owner = await authRepo.create({ name: 'Owner', email: 'owner@test.com', passwordHash: 'hash' });
      const developer = await authRepo.create({ name: 'Developer', email: 'dev@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', owner.id);

      // Add developer directly to database
      db.getDb().insert(organizationMembers).values({
        organizationId: org.id,
        userId: developer.id,
        role: 'developer',
        invitedBy: owner.id,
      }).run();

      await expect(service.checkOrgOwner(developer.id, org.id))
        .rejects.toThrow('只有组织 owner 可以执行此操作');
    });
  });

  describe('getOrgRole', () => {
    it('should return owner for super admin', async () => {
      const authRepo = container.resolve(AuthRepository);
      const admin = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', admin.id);

      const role = await service.getOrgRole(admin.id, org.id);
      expect(role).toBe('owner');
    });

    it('should return null for non-member', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user1 = await authRepo.create({ name: 'User1', email: 'user1@test.com', passwordHash: 'hash' });
      const user2 = await authRepo.create({ name: 'User2', email: 'user2@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user1.id);

      const role = await service.getOrgRole(user2.id, org.id);
      expect(role).toBeNull();
    });
  });

  describe('checkProjectAccess', () => {
    it('should return project for org member', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Admin', email: 'admin@test.com', passwordHash: 'hash' });
      const orgRepo = container.resolve(OrganizationRepository);
      const org = await orgRepo.createWithOwner('Test Org', user.id);
      const projectRepo = container.resolve(ProjectRepository);
      const project = await projectRepo.create({ name: 'Test Project', templateType: 'node', organizationId: org.id, createdBy: user.id });

      const result = await service.checkProjectAccess(user.id, project.id);
      expect(result.name).toBe('Test Project');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(service.checkProjectAccess(1, 99999))
        .rejects.toThrow('项目不存在');
    });
  });
});