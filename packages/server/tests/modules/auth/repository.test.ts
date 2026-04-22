import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import { runMigrations } from '../../../src/db/migrate-runner.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-auth-repo.db');

describe('AuthRepository', () => {
  let repo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    runMigrations(db.getSqlite());
    container.registerInstance(DatabaseConnection, db);
    repo = new AuthRepository(db);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
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
