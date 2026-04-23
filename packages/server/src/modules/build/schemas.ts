import { z } from 'zod';
import { projectIdParamSchema } from '../../shared/schemas.js';

export const createBuildSchema = z.object({
  projectId: z.number().int().positive('项目ID必须是正整数'),
});

export const buildIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '构建ID必须是数字').transform(Number),
});

export { projectIdParamSchema as projectIdParamsSchema };

export type CreateBuildInput = z.infer<typeof createBuildSchema>;