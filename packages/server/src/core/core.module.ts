import 'reflect-metadata';
import { container } from 'tsyringe';
import { EncryptionService } from './crypto/encryption.service.js';
import { LoggerService } from './logger/logger.js';
import { AIClientFactory } from './ai/ai-client-factory.js';
import { AuthMiddlewareService } from '../middleware/auth-middleware.service.js';
import { getConfig } from './config.js';

export function registerCoreModule(): void {
  container.registerSingleton(EncryptionService);

  const config = getConfig();
  const encryptionService = container.resolve(EncryptionService);
  if (config.claudeConfigEncryptionKey) {
    encryptionService.setKey(config.claudeConfigEncryptionKey);
  }

  container.registerSingleton(LoggerService);
  container.registerSingleton(AIClientFactory);
  container.registerSingleton(AuthMiddlewareService);
}