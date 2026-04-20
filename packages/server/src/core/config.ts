import { z } from 'zod';

const configSchema = z.object({
  port: z.number().int().positive().default(4000),
  dbPath: z.string().default('data/code-link.db'),
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  corsOrigin: z.string().default('http://localhost:3000'),
  corsOrigins: z.array(z.string()).optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  anthropicApiKey: z.string().optional(),
  claudeConfigEncryptionKey: z.string().optional(),
  adminEmails: z.array(z.string()).optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : undefined;

  return configSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    dbPath: process.env.DB_PATH,
    jwtSecret: process.env.JWT_SECRET || 'code-link-dev-secret-key-min-32-chars',
    corsOrigin: process.env.CORS_ORIGIN,
    corsOrigins,
    logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    claudeConfigEncryptionKey: process.env.CLAUDE_CONFIG_ENCRYPTION_KEY,
    adminEmails: process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : undefined,
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
