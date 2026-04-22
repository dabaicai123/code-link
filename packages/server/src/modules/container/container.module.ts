import 'reflect-metadata';
import { container } from 'tsyringe';
import { DockerService } from './lib/docker.service.js';
import { ContainerService } from './service.js';
import { ContainerController } from './controller.js';

export function registerContainerModule(): void {
  container.registerSingleton(DockerService);
  container.registerSingleton(ContainerService);
  container.registerSingleton(ContainerController);
}

export { DockerService } from './lib/docker.service.js';
export { ContainerService } from './service.js';
export { ContainerController } from './controller.js';
export { createContainerRoutes } from './routes.js';
export { projectIdParamsSchema } from './schemas.js';
export type { ProjectIdParams } from './schemas.js';
export type { ContainerStatus, ContainerStartResult, ContainerStopResult } from './types.js';
