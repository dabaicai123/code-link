export interface Build {
  id: number;
  project_id: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  preview_port: number | null;
  created_at: string;
  completed_at: string | null;
}