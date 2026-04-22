import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { AuthService } from '../../../src/modules/auth/service.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { runMigrations } from '../../../src/db/migrate-runner.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-auth-service.db');

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (password: string, rounds: number) => `hashed_${password}`),
    compare: vi.fn(async (password: string, hash: string) => hash === `hashed_${password}`),
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    runMigrations(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    container.registerSingleton(AuthRepository);
    container.registerSingleton(AuthService);

    service = container.resolve(AuthService);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('register', () => {
    it('should register new user', async () => {
      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.user.name).toBe('Test User');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictError for duplicate email', async () => {
      await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await expect(service.register({
        name: 'Another User',
        email: 'test@example.com',
        password: 'password456',
      })).rejects.toThrow('该邮箱已被注册');
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw AuthError for wrong password', async () => {
      await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await expect(service.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      })).rejects.toThrow('邮箱或密码错误');
    });

    it('should throw AuthError for non-existent user', async () => {
      await expect(service.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      })).rejects.toThrow('邮箱或密码错误');
    });
  });

  describe('getUser', () => {
    it('should return user without password', async () => {
      const { user: created } = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const user = await service.getUser(created.id);
      expect(user).toBeDefined();
      expect(user?.name).toBe('Test User');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('should return null for non-existent user', async () => {
      const user = await service.getUser(99999);
      expect(user).toBeNull();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const { token, user: created } = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const userId = await service.verifyToken(token);
      expect(userId).toBe(created.id);
    });

    it('should throw for invalid token', async () => {
      await expect(service.verifyToken('invalid-token')).rejects.toThrow();
    });
  });
});
