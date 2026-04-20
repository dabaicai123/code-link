import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resetConfig } from '../../src/core/config.js';

describe('Config required environment variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    resetConfig();
    process.env = originalEnv;
  });

  describe('JWT_SECRET validation', () => {
    it('should throw when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      expect(() => loadConfig()).toThrow('JWT_SECRET must be set and at least 32 characters');
    });

    it('should throw when JWT_SECRET is less than 32 chars', () => {
      process.env.JWT_SECRET = 'short-key';
      expect(() => loadConfig()).toThrow('JWT_SECRET must be at least 32 characters');
    });

    it('should accept JWT_SECRET of 32+ chars', () => {
      process.env.JWT_SECRET = 'this-is-a-valid-secret-key-32-characters!';
      const config = loadConfig();
      expect(config.jwtSecret).toBe('this-is-a-valid-secret-key-32-characters!');
    });
  });

  describe('ADMIN_PASSWORD validation', () => {
    it('should throw when ADMIN_PASSWORD is not set in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_PASSWORD;
      process.env.JWT_SECRET = 'valid-secret-key-32-characters-minimum';
      expect(() => loadConfig()).toThrow('ADMIN_PASSWORD is required in production');
    });

    it('should allow empty ADMIN_PASSWORD in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ADMIN_PASSWORD;
      process.env.JWT_SECRET = 'valid-secret-key-32-characters-minimum';
      const config = loadConfig();
      expect(config.adminPassword).toBeUndefined();
    });
  });
});