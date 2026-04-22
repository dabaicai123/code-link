'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCurrentUser } from '@/lib/queries';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary text-text-muted">
        加载中...
      </div>
    );
  }

  return null;
}
