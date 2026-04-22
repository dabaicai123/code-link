import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/db/index.js';
import { resetConfig } from '../../../src/core/config.js';
import { setupTestDb, teardownTestDb } from '../../helpers/test-db.js';

describe('AuthRepository', () => {
  let repo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    setupTestDb();
    resetConfig();
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    db = container.resolve(DatabaseConnection);
    repo = new AuthRepository(db);
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('should create user', async () => {
    const user = await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    expect(user.id).toBeDefined();
    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
  });

  it('should find user by email', async () => {
    await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    const found = await repo.findByEmail('test@example.com');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Test User');
  });

  it('should find user by id', async () => {
    const created = await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    const found = await repo.findById(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });

  it('should return undefined for non-existent email', async () => {
    const found = await repo.findByEmail('nonexistent@example.com');
    expect(found).toBeUndefined();
  });

  it('should find email by id', async () => {
    const created = await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    const email = await repo.findEmailById(created.id);
    expect(email).toBe('test@example.com');
  });
});