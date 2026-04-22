import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { ClaudeConfigService } from '../../../src/modules/claude-config/service.js';
import { ClaudeConfigRepository } from '../../../src/modules/claude-config/repository.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { runMigrations } from '../../../src/db/migrate-runner.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-claude-config-service.db');

// Mock encryption functions
vi.mock('../../../src/crypto/aes.js', () => ({
  encrypt: vi.fn((data: string) => `encrypted:${data}`),
  decrypt: vi.fn((data: string) => data.replace('encrypted:', '')),
  isEncryptionKeySet: vi.fn(() => true),
}));

describe('ClaudeConfigService', () => {
  let service: ClaudeConfigService;
  let db: DatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    runMigrations(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    container.registerSingleton(AuthRepository);
    container.registerSingleton(ClaudeConfigRepository);
    container.registerSingleton(ClaudeConfigService);

    service = container.resolve(ClaudeConfigService);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('getConfig', () => {
    it('should return default config when user has no config', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const result = await service.getConfig(user.id);

      expect(result.hasConfig).toBe(false);
      expect(result.config.env.ANTHROPIC_AUTH_TOKEN).toBe('');
    });

    it('should return user config when exists', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const repo = container.resolve(ClaudeConfigRepository);

      const testConfig = JSON.stringify({
        env: { ANTHROPIC_AUTH_TOKEN: 'test-token' },
        skipDangerousModePermissionPrompt: true,
      });
      await repo.upsert(user.id, `encrypted:${testConfig}`);

      const result = await service.getConfig(user.id);

      expect(result.hasConfig).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('should save valid config', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const config = {
        env: { ANTHROPIC_AUTH_TOKEN: 'test-token' },
        skipDangerousModePermissionPrompt: true,
      };

      await service.saveConfig(user.id, config);

      const result = await service.getConfig(user.id);
      expect(result.hasConfig).toBe(true);
    });

    it('should throw error for missing auth token', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const config = {
        env: { ANTHROPIC_AUTH_TOKEN: '' },
      };

      await expect(service.saveConfig(user.id, config))
        .rejects.toThrow('ANTHROPIC_AUTH_TOKEN 不能为空');
    });
  });

  describe('deleteConfig', () => {
    it('should delete user config', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const repo = container.resolve(ClaudeConfigRepository);

      await repo.upsert(user.id, 'encrypted:config');
      await service.deleteConfig(user.id);

      const result = await service.getConfig(user.id);
      expect(result.hasConfig).toBe(false);
    });
  });

  describe('hasConfig', () => {
    it('should return true when user has config', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      const repo = container.resolve(ClaudeConfigRepository);
      await repo.upsert(user.id, 'encrypted:config');

      const hasConfig = await service.hasConfig(user.id);
      expect(hasConfig).toBe(true);
    });

    it('should return false when user has no config', async () => {
      const authRepo = container.resolve(AuthRepository);
      const user = await authRepo.create({ name: 'Test', email: 'test@test.com', passwordHash: 'hash' });

      const hasConfig = await service.hasConfig(user.id);
      expect(hasConfig).toBe(false);
    });
  });
});
