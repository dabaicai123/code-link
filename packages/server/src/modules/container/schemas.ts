import { z } from 'zod';

export const projectIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;