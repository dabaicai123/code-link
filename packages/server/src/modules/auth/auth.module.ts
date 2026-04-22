import 'reflect-metadata';
import { container } from 'tsyringe';
import { AuthRepository } from './repository.js';
import { AuthService } from './service.js';
import { AuthController } from './controller.js';

export function registerAuthModule(): void {
  container.registerSingleton(AuthRepository);
  container.registerSingleton(AuthService);
  container.registerSingleton(AuthController);
}

export { AuthService } from './service.js';
export { AuthController } from './controller.js';
export { createAuthRoutes } from './routes.js';
export { registerSchema, loginSchema } from './schemas.js';
export type { RegisterInput, LoginInput } from './schemas.js';
export type { AuthResult, UserWithoutPassword } from './types.js';
