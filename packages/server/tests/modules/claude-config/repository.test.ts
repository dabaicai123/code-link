import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { ClaudeConfigRepository } from '../../../src/modules/claude-config/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { runMigrations } from '../../../src/db/migrate-runner.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-claude-config-repo.db');

describe('ClaudeConfigRepository', () => {
  let repo: ClaudeConfigRepository;
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
    repo = new ClaudeConfigRepository(db);
    userRepo = new AuthRepository(db);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('findByUserId', () => {
    it('should return config for user', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      await repo.upsert(user.id, 'encrypted-config');

      const config = await repo.findByUserId(user.id);
      expect(config?.config).toBe('encrypted-config');
    });

    it('should return undefined for non-existent config', async () => {
      const config = await repo.findByUserId(99999);
      expect(config).toBeUndefined();
    });
  });

  describe('upsert', () => {
    it('should create new config', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const config = await repo.upsert(user.id, 'new-config');

      expect(config.config).toBe('new-config');
    });

    it('should update existing config', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      await repo.upsert(user.id, 'old-config');
      const updated = await repo.upsert(user.id, 'new-config');

      expect(updated.config).toBe('new-config');
    });
  });

  describe('delete', () => {
    it('should delete config', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      await repo.upsert(user.id, 'test-config');

      await repo.delete(user.id);

      const config = await repo.findByUserId(user.id);
      expect(config).toBeUndefined();
    });
  });

  describe('hasConfig', () => {
    it('should return true for existing config', async () => {
      const user = await userRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      await repo.upsert(user.id, 'test-config');

      const hasConfig = await repo.hasConfig(user.id);
      expect(hasConfig).toBe(true);
    });

    it('should return false for non-existent config', async () => {
      const hasConfig = await repo.hasConfig(99999);
      expect(hasConfig).toBe(false);
    });
  });
});
