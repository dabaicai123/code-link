import type { SelectProject, OrgRole } from '../db/schema/index.js';
import type { Logger } from '../core/logger/types.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: number;
      orgRole?: OrgRole;
      project?: SelectProject;
      membership?: { role: OrgRole };
      log?: Logger;
      validatedParams?: Record<string, any>; // Zod-transformed route params
    }
  }
}

export {};
