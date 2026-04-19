import 'reflect-metadata';
import { container } from 'tsyringe';
import { BuildRepository } from './repository.js';
import { BuildService } from './service.js';
import { BuildController } from './controller.js';

export function registerBuildModule(): void {
  container.registerSingleton(BuildRepository);
  container.registerSingleton(BuildService);
  container.registerSingleton(BuildController);
}

export { BuildRepository } from './repository.js';
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
