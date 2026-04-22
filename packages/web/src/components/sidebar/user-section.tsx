'use client';

import { LogOut } from 'lucide-react';

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
  return (
    <div className="px-4 py-3 border-t border-border-default flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-accent-light flex items-center justify-center text-accent-primary font-bold text-sm">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-[13px] font-medium truncate">{user.name}</div>
        <div className="text-text-muted text-[11px] truncate">{user.email}</div>
      </div>
      <button
        onClick={onLogout}
        className="text-text-muted hover:text-accent-primary transition-colors cursor-pointer"
        title="退出登录"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}