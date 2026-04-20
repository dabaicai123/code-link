'use client';

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
    <div className="p-3 border-t border-border flex items-center gap-2">
      <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-white text-[11px] font-medium">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-foreground text-[12px]">{user.name}</div>
        <div className="text-muted-foreground text-[11px]">{user.email}</div>
      </div>
      <button
        onClick={onLogout}
        className="text-muted-foreground hover:text-foreground text-sm"
        title="退出登录"
      >
        ⚙
      </button>
    </div>
  );
}