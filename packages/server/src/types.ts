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
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  github_repo: string | null;
  created_by: number;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'owner' | 'developer' | 'product';
}

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