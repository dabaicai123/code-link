// Re-export from modules
export { AuthService } from '../modules/auth/service.js';
export type { RegisterInput, LoginInput } from '../modules/auth/schemas.js';

export { OrganizationService } from './organization.service.js';
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  OrganizationDetail,
} from './organization.service.js';

export { ProjectService } from './project.service.js';
export type {
  CreateProjectInput,
  AddRepoInput,
} from './project.service.js';

export { DraftService } from './draft.service.js';