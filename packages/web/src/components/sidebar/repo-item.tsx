'use client';

interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repo_name: string;
  repo_url: string;
}

interface RepoItemProps {
  repo: Repo;
  onClone?: () => void;
  onDelete?: () => void;
  isCloning?: boolean;
}

const PROVIDER_CONFIG = {
  github: {
    icon: 'GH',
    color: '#8b949e',
    label: 'GitHub',
  },
  gitlab: {
    icon: 'GL',
    color: '#fc6d26',
    label: 'GitLab',
  },
};

export function RepoItem({ repo, onClone, onDelete, isCloning }: RepoItemProps) {
  const config = PROVIDER_CONFIG[repo.provider];

  return (
    <div
      style={{
        padding: '8px 12px 8px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '4px',
        marginBottom: '4px',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: config.color,
          width: '20px',
          textAlign: 'center',
        }}
      >
        {config.icon}
      </span>
      <span style={{ color: 'var(--text-primary)', fontSize: '12px', flex: 1 }}>
        {repo.repo_name}
      </span>
      <span
        style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-card)',
          color: config.color,
        }}
      >
        {config.label}
      </span>
      {onClone && (
        <button
          onClick={onClone}
          disabled={isCloning}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-color)',
            fontSize: '11px',
            cursor: isCloning ? 'wait' : 'pointer',
            opacity: isCloning ? 0.5 : 1,
          }}
        >
          {isCloning ? 'clone中...' : 'clone'}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--status-error)',
            fontSize: '11px',
            cursor: 'pointer',
            opacity: 0.7,
          }}
        >
          删除
        </button>
      )}
    </div>
  );
}