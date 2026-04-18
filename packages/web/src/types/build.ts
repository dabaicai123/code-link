export interface Build {
  id: number;
  projectId: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  previewPort: number | null;
  createdAt: string;
}