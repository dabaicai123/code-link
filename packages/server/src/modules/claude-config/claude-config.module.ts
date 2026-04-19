import 'reflect-metadata';
import { container } from 'tsyringe';
import { ClaudeConfigRepository } from './repository.js';
import { ClaudeConfigService } from './service.js';
import { ClaudeConfigController } from './controller.js';

export function registerClaudeConfigModule(): void {
  container.registerSingleton(ClaudeConfigRepository);
  container.registerSingleton(ClaudeConfigService);
  container.registerSingleton(ClaudeConfigController);
}

export { ClaudeConfigRepository } from './repository.js';
export { ClaudeConfigService } from './service.js';
export { ClaudeConfigController } from './controller.js';
export { createClaudeConfigRoutes } from './routes.js';
export { claudeConfigSchema, claudeEnvSchema } from './schemas.js';
export type { ClaudeConfig, ClaudeEnv } from './schemas.js';
export type { ClaudeConfigResponse } from './types.js';
export { DEFAULT_CONFIG } from './types.js';
