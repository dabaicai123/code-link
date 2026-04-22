import { z } from 'zod/v4';

export const projectIdParamsSchema = z.object({
  projectId: z.string().transform(Number),
});