'use client';

import { ArrowLeft, User, Users, Terminal, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SettingsPage = 'account' | 'organization' | 'claude-code';

export interface SettingsSidebarProps {
  activePage: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
  onBack: () => void;
  user: { id: number; name: string; email: string };
  onLogout: () => void;
}

const NAV_GROUPS: { label: string; items: { id: SettingsPage; label: string; icon: React.ElementType }[] }[] = [
  {
    label: '账户',
    items: [
      { id: 'account', label: '个人资料', icon: User },
    ],
  },
  {
    label: '团队',
    items: [
      { id: 'organization', label: '组织管理', icon: Users },
    ],
  },
  {
    label: '开发者',
    items: [
      { id: 'claude-code', label: 'Claude Code', icon: Terminal },
    ],
  },
];

export function SettingsSidebar({ activePage, onPageChange, onBack, user, onLogout }: SettingsSidebarProps) {
  return (
    <div className="w-[240px] h-full bg-bg-secondary flex flex-col border-r border-border-default">
      <div className="px-4 pt-5 pb-4 border-b border-border-default flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-hover hover:text-accent-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-text-primary text-base font-semibold">设置</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-text-muted text-[11px] tracking-wide uppercase px-3 pt-3 pb-1">
              {group.label}
            </div>
            {group.items.map((item) => (
              <div
                key={item.label}
                onClick={() => onPageChange(item.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--corner-md)] text-[13px] cursor-pointer transition-colors duration-150',
                  activePage === item.id
                    ? 'bg-bg-active text-accent-primary font-semibold'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <item.icon className={cn('w-[18px] h-[18px]', activePage === item.id ? 'opacity-100' : 'opacity-70')} />
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </div>

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
    </div>
  );
}