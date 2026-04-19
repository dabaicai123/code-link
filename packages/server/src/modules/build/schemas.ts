import { z } from 'zod';

export const createBuildSchema = z.object({
  projectId: z.number().int().positive('项目ID必须是正整数'),
});

export const projectIdParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export const buildIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '构建ID必须是数字').transform(Number),
});

export type CreateBuildInput = z.infer<typeof createBuildSchema>;
