'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLogout, useCurrentUser } from '@/lib/queries';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api, ApiError } from '@/lib/api';
import type { OrganizationInvitation } from '@/types/invitation';
import { InvitationList } from '@/components/organization/invitation-list';

export default function InvitationsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { isLoading: authLoading } = useCurrentUser();
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchInvitations();
  }, [user]);

  const fetchInvitations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyInvitations();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载邀请列表失败');
    } finally { setLoading(false); }
  };

  const handleLogout = () => { logout(); router.push('/login'); };

  if (authLoading || !user) {
    return <div className="h-screen flex items-center justify-center bg-bg-primary text-text-muted">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-bg-secondary">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-none border-none text-text-muted cursor-pointer text-sm flex items-center gap-1">← 返回</button>
          <h1 className="text-foreground text-lg m-0">我的邀请</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent-primary rounded-md flex items-center justify-center text-white text-xs font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-foreground text-sm">{user.name}</span>
          <button onClick={handleLogout} className="bg-none border-none text-text-muted cursor-pointer text-[13px] ml-2">退出</button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-[800px] mx-auto">
        {loading ? (
          <div className="text-center py-10 text-text-secondary">加载中...</div>
        ) : error ? (
          <div className="p-5 bg-destructive/10 border border-destructive rounded-md text-destructive">
            {error}
            <Button onClick={fetchInvitations} variant="secondary" className="ml-3">重试</Button>
          </div>
        ) : (
          <InvitationList invitations={invitations} onRefresh={fetchInvitations} />
        )}
      </div>
    </div>
  );
}