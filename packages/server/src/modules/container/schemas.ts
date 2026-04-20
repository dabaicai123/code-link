import { z } from 'zod';

export const containerIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export type ContainerIdParams = z.infer<typeof containerIdParamsSchema>;
