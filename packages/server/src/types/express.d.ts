import type { SelectProject, OrgRole } from '../db/schema/index.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: number;
      orgRole?: OrgRole;
      project?: SelectProject;
      membership?: { role: OrgRole };
    }
  }
}

export {};
