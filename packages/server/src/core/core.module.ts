import 'reflect-metadata';
import { container } from 'tsyringe';
import { EncryptionService } from './crypto/encryption.service.js';
import { LoggerService } from './logger/logger.js';
import { AIClientFactory } from './ai/ai-client-factory.js';
import { AuthMiddlewareService } from '../middleware/auth-middleware.service.js';
import { getConfig } from './config.js';

let _encryptionKeyApplied = false;

export function registerCoreModule(): void {
  container.registerSingleton(EncryptionService);

  if (!_encryptionKeyApplied) {
    const config = getConfig();
    if (config.claudeConfigEncryptionKey) {
      const encryptionService = container.resolve(EncryptionService);
      encryptionService.setKey(config.claudeConfigEncryptionKey);
    }
    _encryptionKeyApplied = true;
  }

  container.registerSingleton(LoggerService);
  container.registerSingleton(AIClientFactory);
  container.registerSingleton(AuthMiddlewareService);
}