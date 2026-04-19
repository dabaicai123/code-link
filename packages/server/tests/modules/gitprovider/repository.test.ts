// tests/modules/gitprovider/repository.test.ts
import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { GitProviderRepository } from '../../../src/modules/gitprovider/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { initSchema } from '../../../src/db/init.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-gitprovider-repo.db');

describe('GitProviderRepository', () => {
  let repo: GitProviderRepository;
  let userRepo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    initSchema(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    repo = new GitProviderRepository(db);
    userRepo = new AuthRepository(db);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('upsert', () => {
    it('should create new token', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const token = await repo.upsert({
        userId: user.id,
        provider: 'github',
        accessToken: 'test-token',
      });

      expect(token.accessToken).toBe('test-token');
      expect(token.provider).toBe('github');
    });

    it('should update existing token', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      await repo.upsert({
        userId: user.id,
        provider: 'github',
        accessToken: 'old-token',
      });

      const updated = await repo.upsert({
        userId: user.id,
        provider: 'github',
        accessToken: 'new-token',
      });

      expect(updated.accessToken).toBe('new-token');
    });
  });

  describe('findByUserAndProvider', () => {
    it('should return token for user and provider', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      await repo.upsert({
        userId: user.id,
        provider: 'github',
        accessToken: 'test-token',
      });

      const token = await repo.findByUserAndProvider(user.id, 'github');

      expect(token).toBeDefined();
      expect(token?.accessToken).toBe('test-token');
    });

    it('should return undefined for non-existent token', async () => {
      const token = await repo.findByUserAndProvider(99999, 'github');
      expect(token).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete token', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      await repo.upsert({
        userId: user.id,
        provider: 'github',
        accessToken: 'test-token',
      });

      await repo.delete(user.id, 'github');

      const token = await repo.findByUserAndProvider(user.id, 'github');
      expect(token).toBeUndefined();
    });
  });

  describe('hasToken', () => {
    it('should return true for existing token', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      await repo.upsert({
        userId: user.id,
        provider: 'github',
        accessToken: 'test-token',
      });

      const hasToken = await repo.hasToken(user.id, 'github');
      expect(hasToken).toBe(true);
    });

    it('should return false for non-existent token', async () => {
      const hasToken = await repo.hasToken(99999, 'github');
      expect(hasToken).toBe(false);
    });
  });
});
