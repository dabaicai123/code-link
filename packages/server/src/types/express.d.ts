import type { SelectProject, OrgRole } from '../db/schema/index.js';
import type { Logger } from '../core/logger/types.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string; // Set by requestIdMiddleware, always present after
      userId?: number;
      orgRole?: OrgRole;
      project?: SelectProject;
      membership?: { role: OrgRole };
      log?: Logger; // Child logger with request context (requestId, userId)
    }
  }
}

export {};
