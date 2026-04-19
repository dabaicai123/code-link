import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/core/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load config with defaults', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    const config = loadConfig();
    expect(config.port).toBe(4000);
    expect(config.dbPath).toBe('data/code-link.db');
    expect(config.corsOrigin).toBe('http://localhost:3000');
    expect(config.logLevel).toBe('info');
  });

  it('should throw if JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => loadConfig()).toThrow();
  });

  it('should use environment variables when set', () => {
    process.env.PORT = '5000';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.DB_PATH = '/custom/path.db';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();
    expect(config.port).toBe(5000);
    expect(config.dbPath).toBe('/custom/path.db');
    expect(config.logLevel).toBe('debug');
  });
});
