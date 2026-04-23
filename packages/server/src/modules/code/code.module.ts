import 'reflect-metadata';
import { container } from 'tsyringe';
import { CodeService } from './service.js';
import { CodeController } from './controller.js';
import { CodeServerManager } from './lib/code-server-manager.js';
import { DockerService } from '../container/lib/docker.service.js';
import { ProjectRepository } from '../project/repository.js';
import { PermissionService } from '../../shared/permission.service.js';

export function registerCodeModule(): void {
  container.registerSingleton(CodeServerManager);
  container.registerSingleton(CodeService);
  container.registerSingleton(CodeController);
}

export { CodeService, CodeController, CodeServerManager };
export { resetCodeServiceCache } from './service.js';
export { createCodeRoutes } from './routes.js';