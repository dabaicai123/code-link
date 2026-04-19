'use client';

import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
}

interface UserSectionProps {
  user: User;
  onLogout: () => void;
}

export function UserSection({ user, onLogout }: UserSectionProps) {
  const router = useRouter();

  return (
    <div
      style={{
        padding: '12px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          backgroundColor: 'var(--accent-primary)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{user.name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{user.email}</div>
      </div>
      <button
        onClick={() => router.push('/settings')}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '12px',
          padding: '4px 8px',
        }}
        title="设置"
      >
        ⚙
      </button>
      <button
        onClick={onLogout}
        className="btn btn-secondary"
        style={{ padding: '4px 8px', fontSize: '12px' }}
        title="退出"
      >
        退出
      </button>
    </div>
  );
}