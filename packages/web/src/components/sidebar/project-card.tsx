'use client';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

const TEMPLATE_LABELS: Record<Project['template_type'], string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  onClick?: () => void;
}

export function ProjectCard({ project, isActive, onClick }: ProjectCardProps) {
  const statusColor = {
    running: 'var(--status-success)',
    stopped: 'var(--status-warning)',
    created: 'var(--text-disabled)',
  }[project.status];

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
        border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        marginBottom: '6px',
        opacity: project.status === 'stopped' ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{project.name}</span>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor }} />
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
        {TEMPLATE_LABELS[project.template_type]}
      </div>
    </div>
  );
}
