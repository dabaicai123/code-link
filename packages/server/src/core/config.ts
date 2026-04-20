import { z } from 'zod';

const configSchema = z.object({
  port: z.number().int().positive().default(4000),
  dbPath: z.string().default('data/code-link.db'),
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  corsOrigin: z.string().default('http://localhost:3000'),
  corsOrigins: z.array(z.string()).optional(), // Multiple origins for production
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  anthropicApiKey: z.string().optional(),
  claudeConfigEncryptionKey: z.string().optional(),
  adminEmails: z.array(z.string()).optional(),
  adminPassword: z.string().optional(),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

const TEST_JWT_SECRET = 'e2e-test-secret-key-minimum-32-chars-long';

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const isTest = nodeEnv === 'test';

  if (!isTest && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }

  if (nodeEnv === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is required in production');
  }

  return configSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    dbPath: process.env.DB_PATH,
    jwtSecret: process.env.JWT_SECRET || (isTest ? TEST_JWT_SECRET : undefined),
    corsOrigin: process.env.CORS_ORIGIN,
    corsOrigins: process.env.CORS_ORIGINS?.split(',').map(s => s.trim()),
    logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    claudeConfigEncryptionKey: process.env.CLAUDE_CONFIG_ENCRYPTION_KEY,
    adminEmails: process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : undefined,
    adminPassword: process.env.ADMIN_PASSWORD,
    nodeEnv,
  });
}

let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}