'use client';

import type { DraftOnlineUser } from '@/lib/socket/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type OnlineUser = DraftOnlineUser;

interface OnlineUsersProps {
  users: OnlineUser[];
  currentUserId?: number;
  maxDisplay?: number;
}

export function OnlineUsers({ users, currentUserId, maxDisplay = 5 }: OnlineUsersProps) {
  if (users.length === 0) {
    return (
      <div className="text-text-secondary text-[11px]">
        暂无在线成员
      </div>
    );
  }

  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  return (
    <div className="flex items-center gap-1">
      <span className="text-text-secondary text-[11px] mr-1">
        在线 {users.length} 人:
      </span>
      {displayUsers.map((user) => (
        <div
          key={user.userId}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px]',
            user.userId === currentUserId
              ? 'bg-accent-primary text-white'
              : 'bg-bg-hover text-text-primary'
          )}
          title={user.userName}
        >
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px] bg-bg-hover">
              {(user.userName?.[0] || '?').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[80px] truncate">
            {user.userName}
          </span>
        </div>
      ))}
      {remainingCount > 0 && (
        <span className="text-text-secondary text-[11px]">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}