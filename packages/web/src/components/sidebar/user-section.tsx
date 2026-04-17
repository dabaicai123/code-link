'use client';

interface User {
  id: string;
  email: string;
  name: string;
}

interface UserSectionProps {
  user: User;
  onLogout: () => void;
}

export function UserSection({ user, onLogout }: UserSectionProps) {
  return (
    <div
      style={{
        padding: '12px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          backgroundColor: 'var(--accent-color)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 500,
        }}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{user.name}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{user.email}</div>
      </div>
      <button
        onClick={onLogout}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
        title="退出登录"
      >
        ⚙️
      </button>
    </div>
  );
}
