import 'reflect-metadata';
import { container } from 'tsyringe';
import { DraftRepository } from './repository.js';
import { DraftService } from './service.js';
import { DraftController } from './controller.js';

export function registerDraftModule(): void {
  container.registerSingleton(DraftRepository);
  container.registerSingleton(DraftService);
  container.registerSingleton(DraftController);
}

export { DraftService } from './service.js';
export { DraftController } from './controller.js';
export { createDraftRoutes } from './routes.js';
export {
  createDraftSchema,
  updateDraftStatusSchema,
  createDraftMessageSchema,
  confirmMessageSchema,
  addDraftMemberSchema,
  draftIdParamsSchema,
} from './schemas.js';
export type {
  CreateDraftInput,
  UpdateDraftStatusInput,
  CreateDraftMessageInput,
  ConfirmMessageInput,
  AddDraftMemberInput,
} from './schemas.js';
export type {
  DraftDetail,
  DraftMemberWithUser,
  DraftMessageWithUser,
  MessageConfirmationWithUser,
  DraftContext,
} from './types.js';