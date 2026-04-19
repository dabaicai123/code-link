import type { SelectProject, SelectProjectRepo, OrgRole } from '../../db/schema/index.js';

export interface ProjectMemberWithUser {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: OrgRole;
}

export interface ProjectDetail extends SelectProject {
  members: ProjectMemberWithUser[];
  repos: SelectProjectRepo[];
}

export interface ParsedRepoUrl {
  provider: 'github' | 'gitlab';
  repoName: string;
}