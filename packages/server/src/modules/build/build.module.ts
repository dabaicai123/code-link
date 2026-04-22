import 'reflect-metadata';
import { container } from 'tsyringe';
import { BuildRepository } from './repository.js';
import { BuildManager } from './lib/build-manager.js';
import { PreviewContainerManager } from './lib/preview-container.js';
import { PortManager } from './lib/port-manager.js';
import { BuildService } from './service.js';
import { BuildController } from './controller.js';

export function registerBuildModule(): void {
  container.registerSingleton(BuildRepository);
  container.registerSingleton(BuildManager);
  container.registerSingleton(PreviewContainerManager);
  container.registerSingleton(PortManager);
  container.registerSingleton(BuildService);
  container.registerSingleton(BuildController);
}

export { BuildService } from './service.js';
export { BuildController } from './controller.js';
export { createBuildRoutes } from './routes.js';
export {
  createBuildSchema,
  projectIdParamsSchema,
  buildIdParamsSchema,
} from './schemas.js';
export type {
  CreateBuildInput,
  PreviewInfo,
  BuildDetail,
} from './types.js';
