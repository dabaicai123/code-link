export interface Project {
  id: number;
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  createdAt: string;
}

export type TemplateType = Project['templateType'];
export type ProjectStatus = Project['status'];

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  running: 'var(--status-success)',
  stopped: 'var(--status-warning)',
  created: 'var(--text-disabled)',
};