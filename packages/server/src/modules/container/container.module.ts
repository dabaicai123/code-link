import 'reflect-metadata';
import { container } from 'tsyringe';
import { ContainerService } from './service.js';
import { ContainerController } from './controller.js';

export function registerContainerModule(): void {
  container.registerSingleton(ContainerService);
  container.registerSingleton(ContainerController);
}

export { ContainerService } from './service.js';
export { ContainerController } from './controller.js';
export { createContainerRoutes } from './routes.js';
export { containerIdParamsSchema } from './schemas.js';
export type { ContainerIdParams } from './schemas.js';
export type { ContainerStatus, ContainerStartResult, ContainerStopResult } from './types.js';
