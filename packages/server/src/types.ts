import { TemplateType } from './docker/templates.js';

export interface ContainerInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'created';
  projectId: number;
  templateType: TemplateType;
  volumePath: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  avatar: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  organization_id: number;
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  created_by: number;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'owner' | 'developer' | 'product';
}

export interface Organization {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: 'owner' | 'developer' | 'member';
  invited_by: number;
  joined_at: string;
}

export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  email: string;
  role: 'owner' | 'developer' | 'member';
  invited_by: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export type OrgRole = 'owner' | 'developer' | 'member';

export interface Message {
  id: number;
  project_id: number;
  user_id: number;
  content: string;
  type: 'chat' | 'notification';
  created_at: string;
}

export interface Build {
  id: number;
  project_id: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  preview_port: number | null;
  created_at: string;
}

export interface ProjectToken {
  id: number;
  user_id: number;
  provider: 'github' | 'gitlab';
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ProjectRepo {
  id: number;
  project_id: number;
  provider: 'github' | 'gitlab';
  repo_url: string;
  repo_name: string;
  branch: string;
  created_at: string;
}