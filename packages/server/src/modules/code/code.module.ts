import 'reflect-metadata';
import { container } from 'tsyringe';
import { CodeService } from './service.js';
import { CodeController } from './controller.js';
import { CodeServerManager } from './lib/code-server-manager.js';
import { DockerService } from '../container/lib/docker.service.js';
import { ProjectRepository } from '../project/repository.js';

export function registerCodeModule(): void {
  container.registerSingleton(CodeServerManager);
  container.registerSingleton(CodeService);
  container.registerSingleton(CodeController);
}

export { CodeService, CodeController, CodeServerManager };
export { createCodeRoutes } from './routes.js';