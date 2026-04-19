'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
    <div className="p-3 border-t border-border flex items-center gap-2.5">
      <div className="w-7 h-7 bg-primary rounded flex items-center justify-center text-white text-[11px] font-semibold">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-foreground text-[13px]">{user.name}</div>
        <div className="text-muted-foreground text-[11px]">{user.email}</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push('/settings')}
        title="设置"
      >
        <span>设置</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onLogout}
        title="退出"
      >
        退出
      </Button>
    </div>
  );
}
