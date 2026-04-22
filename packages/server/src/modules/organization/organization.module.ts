import 'reflect-metadata';
import { container } from 'tsyringe';
import { OrganizationRepository } from './repository.js';
import { OrganizationService } from './service.js';
import { OrganizationController } from './controller.js';

export function registerOrganizationModule(): void {
  container.registerSingleton(OrganizationRepository);
  container.registerSingleton(OrganizationService);
  container.registerSingleton(OrganizationController);
}

export { OrganizationRepository } from './repository.js';
export { OrganizationService } from './service.js';
export { OrganizationController } from './controller.js';
export { createOrganizationRoutes, createInvitationRoutes } from './routes.js';
export {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  orgIdParamsSchema,
} from './schemas.js';
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
} from './schemas.js';
export type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
  OrganizationDetail,
} from './types.js';