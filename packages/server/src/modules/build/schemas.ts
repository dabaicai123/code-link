import { z } from 'zod';
import { projectIdParamSchema, idParamSchema } from '../../shared/schemas.js';

export const createBuildSchema = z.object({
  projectId: z.number().int().positive('项目ID必须是正整数'),
});

export { idParamSchema as buildIdParamsSchema, projectIdParamSchema as projectIdParamsSchema };

export type CreateBuildInput = z.infer<typeof createBuildSchema>;
