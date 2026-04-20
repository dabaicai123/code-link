export interface Project {
  id: number;
  name: string;
  templateType: TemplateType;
  organizationId: number;
  containerId: string | null;
  status: ProjectStatus;
  createdBy: number;
  createdAt: string;
}

export type TemplateType = 'node' | 'node+java' | 'node+python';
export type ProjectStatus = 'created' | 'running' | 'stopped';

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
