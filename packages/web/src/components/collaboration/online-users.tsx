'use client';

import type { DraftOnlineUser } from '@/lib/socket/types';

type OnlineUser = DraftOnlineUser;

interface OnlineUsersProps {
  users: OnlineUser[];
  currentUserId?: number;
  maxDisplay?: number;
}

export function OnlineUsers({ users, currentUserId, maxDisplay = 5 }: OnlineUsersProps) {
  if (users.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        暂无在线成员
      </div>
    );
  }

  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginRight: '4px' }}>
        在线 {users.length} 人:
      </span>
      {displayUsers.map((user) => (
        <div
          key={user.userId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: user.userId === currentUserId ? 'var(--accent-color)' : 'var(--bg-hover)',
            color: user.userId === currentUserId ? 'white' : 'var(--text-primary)',
            fontSize: '11px',
          }}
          title={user.userName}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: user.userId === currentUserId ? 'white' : 'var(--status-success)',
            }}
          />
          <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.userName}
          </span>
        </div>
      ))}
      {remainingCount > 0 && (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          +{remainingCount}
        </span>
      )}
    </div>
  );
}