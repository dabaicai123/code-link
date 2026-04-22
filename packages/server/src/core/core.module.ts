import 'reflect-metadata';
import { container } from 'tsyringe';
import { EncryptionService } from './crypto/encryption.service.js';
import { LoggerService } from './logger/logger.js';
import { AIClientFactory } from './ai/ai-client-factory.js';
import { AuthMiddlewareService } from '../middleware/auth-middleware.service.js';

export function registerCoreModule(): void {
  container.registerSingleton(EncryptionService);
  container.registerSingleton(LoggerService);
  container.registerSingleton(AIClientFactory);
  container.registerSingleton(AuthMiddlewareService);
}