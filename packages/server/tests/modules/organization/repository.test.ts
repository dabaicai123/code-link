import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { OrganizationRepository } from '../../../src/modules/organization/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/db/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { setupTestDb, teardownTestDb } from '../../helpers/test-db.js';

describe('OrganizationRepository', () => {
  let repo: OrganizationRepository;
  let userRepo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    setupTestDb();
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    db = container.resolve(DatabaseConnection);
    repo = new OrganizationRepository(db);
    userRepo = new AuthRepository(db);
  });

  afterEach(() => {
    teardownTestDb();
  });

  describe('createWithOwner', () => {
    it('should create organization with owner member', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user.id);

      expect(org.id).toBeDefined();
      expect(org.name).toBe('Test Org');
      expect(org.createdBy).toBe(user.id);

      const members = await repo.findMembers(org.id);
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(user.id);
      expect(members[0].role).toBe('owner');
    });
  });

  describe('findByUserId', () => {
    it('should return organizations with user role', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user.id);

      const orgs = await repo.findByUserId(user.id);
      expect(orgs.data).toHaveLength(1);
      expect(orgs.data[0].role).toBe('owner');
    });
  });

  describe('findUserMembership', () => {
    it('should return membership for org member', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user.id);

      const membership = await repo.findUserMembership(org.id, user.id);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe('owner');
    });

    it('should return undefined for non-member', async () => {
      const user1 = await userRepo.create({ name: 'User1', email: 'u1@test.com', passwordHash: 'hash' });
      const user2 = await userRepo.create({ name: 'User2', email: 'u2@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user1.id);

      const membership = await repo.findUserMembership(org.id, user2.id);
      expect(membership).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return organization by id', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user.id);

      const found = await repo.findById(org.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Org');
    });

    it('should return undefined for non-existent org', async () => {
      const found = await repo.findById(99999);
      expect(found).toBeUndefined();
    });
  });

  describe('updateName', () => {
    it('should update organization name', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user.id);

      const updated = await repo.updateName(org.id, 'Updated Org');
      expect(updated.name).toBe('Updated Org');
    });
  });

  describe('delete', () => {
    it('should delete organization', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const org = await repo.createWithOwner('Test Org', user.id);

      await repo.delete(org.id);

      const found = await repo.findById(org.id);
      expect(found).toBeUndefined();
    });
  });
});