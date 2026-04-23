import { z } from 'zod';
import { idParamSchema } from '../../shared/schemas.js';

export { idParamSchema as projectIdParamsSchema };

export type ProjectIdParams = z.infer<typeof idParamSchema>;
