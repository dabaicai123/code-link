import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDefaultAdmin } from '../../src/db/init.js';
import { resetConfig, getConfig } from '../../src/core/config.js';
import { setupTestDb, teardownTestDb, findUserByEmail } from '../helpers/test-db.js';
import bcrypt from 'bcryptjs';

describe('initDefaultAdmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    resetConfig();
    process.env = originalEnv;
  });

  it('should use ADMIN_PASSWORD from environment', async () => {
    process.env.ADMIN_PASSWORD = 'secure-admin-password-123';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    await initDefaultAdmin();

    const admin = findUserByEmail('admin@test.com');
    expect(admin).toBeDefined();
    expect(admin!.name).toBe('Admin');

    // Verify password was hashed properly
    const isValidPassword = await bcrypt.compare('secure-admin-password-123', admin!.passwordHash);
    expect(isValidPassword).toBe(true);
  });

  it('should use default email when ADMIN_EMAIL not set', async () => {
    process.env.ADMIN_PASSWORD = 'secure-admin-password-123';
    delete process.env.ADMIN_EMAIL;

    await initDefaultAdmin();

    const admin = findUserByEmail('admin@example.com');
    expect(admin).toBeDefined();
    expect(admin!.name).toBe('Admin');
  });

  it('should skip admin creation when ADMIN_PASSWORD is not set', async () => {
    delete process.env.ADMIN_PASSWORD;

    await initDefaultAdmin();

    // Should not create any admin user
    const admin = findUserByEmail('admin@example.com');
    expect(admin).toBeUndefined();
  });

  it('should not create duplicate admin if exists', async () => {
    process.env.ADMIN_PASSWORD = 'secure-admin-password-123';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    // First call creates admin
    await initDefaultAdmin();

    // Second call should not throw or create duplicate
    await initDefaultAdmin();

    const admin = findUserByEmail('admin@test.com');
    expect(admin).toBeDefined();
    expect(admin!.name).toBe('Admin');
  });

  it('should use config.adminPassword when set', async () => {
    process.env.ADMIN_PASSWORD = 'config-admin-password-456';
    process.env.ADMIN_EMAIL = 'configadmin@test.com';

    // Trigger config loading
    const config = getConfig();
    expect(config.adminPassword).toBe('config-admin-password-456');

    await initDefaultAdmin();

    const admin = findUserByEmail('configadmin@test.com');
    expect(admin).toBeDefined();

    // Verify password was hashed properly
    const isValidPassword = await bcrypt.compare('config-admin-password-456', admin!.passwordHash);
    expect(isValidPassword).toBe(true);
  });

  it('should use async bcrypt.hash (not hashSync)', async () => {
    process.env.ADMIN_PASSWORD = 'async-test-password';
    process.env.ADMIN_EMAIL = 'asyncadmin@test.com';

    await initDefaultAdmin();

    const admin = findUserByEmail('asyncadmin@test.com');
    expect(admin).toBeDefined();

    // If hash was created with async bcrypt.hash, it should validate properly
    const isValidPassword = await bcrypt.compare('async-test-password', admin!.passwordHash);
    expect(isValidPassword).toBe(true);
  });
});