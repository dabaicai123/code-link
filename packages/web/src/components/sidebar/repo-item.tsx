'use client';

interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repoName: string;
  repoUrl: string;
  cloned: boolean;
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
      <span style={{ color: 'var(--text-primary)', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {repo.repoName}
      </span>
      {repo.cloned ? (
        onDelete && (
          <button
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--status-error)',
              fontSize: '11px',
              cursor: 'pointer',
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            删除
          </button>
        )
      ) : onClone && (
        <button
          onClick={onClone}
          disabled={isCloning}
          style={{
            background: 'var(--accent-color)',
            border: 'none',
            color: 'white',
            fontSize: '10px',
            cursor: isCloning ? 'wait' : 'pointer',
            opacity: isCloning ? 0.5 : 1,
            padding: '3px 8px',
            borderRadius: '4px',
            flexShrink: 0,
          }}
        >
          {isCloning ? 'clone中...' : 'clone'}
        </button>
      )}
    </div>
  );
}