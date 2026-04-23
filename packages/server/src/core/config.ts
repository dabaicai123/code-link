import { z } from 'zod';

const configSchema = z.object({
  serverPort: z.coerce.number().default(4000),
  dbPath: z.string().default('data/code-link.db'),
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  claudeConfigEncryptionKey: z.string().min(1, 'CLAUDE_CONFIG_ENCRYPTION_KEY must be set'),
  corsOrigin: z.string().default('http://localhost:3000'),
  corsOrigins: z.array(z.string()).optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  anthropicApiKey: z.string().optional(),
  adminEmails: z.array(z.string()).optional(),
  adminPassword: z.string().optional(),
  superAdminEmails: z.string().default('admin@example.com'),
  dockerHost: z.string().optional(),
  dockerPort: z.coerce.number().optional(),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  webPort: z.coerce.number().default(3000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return configSchema.parse({
    serverPort: process.env.SERVER_PORT || process.env.PORT,
    dbPath: process.env.DB_PATH,
    jwtSecret: process.env.JWT_SECRET,
    claudeConfigEncryptionKey: process.env.CLAUDE_CONFIG_ENCRYPTION_KEY,
    corsOrigin: process.env.CORS_ORIGIN,
    corsOrigins: process.env.CORS_ORIGINS?.split(',').map(s => s.trim()),
    logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    adminEmails: process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : undefined,
    adminPassword: process.env.ADMIN_PASSWORD,
    superAdminEmails: process.env.SUPER_ADMIN_EMAILS,
    dockerHost: process.env.DOCKER_HOST,
    dockerPort: process.env.DOCKER_PORT,
    nodeEnv,
    webPort: process.env.WEB_PORT,
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
