import 'reflect-metadata';
import { container } from 'tsyringe';
import { ProjectRepository } from './repository.js';
import { ProjectService } from './service.js';
import { ProjectController } from './controller.js';

export function registerProjectModule(): void {
  container.registerSingleton(ProjectRepository);
  container.registerSingleton(ProjectService);
  container.registerSingleton(ProjectController);
}

export { ProjectService } from './service.js';
export { ProjectController } from './controller.js';
export { createProjectRoutes } from './routes.js';
export {
  createProjectSchema,
  addRepoSchema,
  projectIdParamsSchema,
} from './schemas.js';
export type {
  CreateProjectInput,
  AddRepoInput,
} from './schemas.js';
export type {
  ProjectDetail,
  ProjectMemberWithUser,
  ParsedRepoUrl,
} from './types.js';