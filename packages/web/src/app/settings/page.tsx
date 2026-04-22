'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLogout, useCurrentUser } from '@/lib/queries';
import { useAuthStore } from '@/lib/stores/auth-store';
import { SettingsSidebar, SettingsPage as SettingsPageType } from '@/components/settings/settings-sidebar';
import { OrganizationTabContent } from '@/components/settings/organization-tab-content';
import { AccountProfile } from '@/components/settings/account-profile';
import { ClaudeCodeConfig } from '@/components/settings/claude-code-config';

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { isLoading: authLoading } = useCurrentUser();
  const [activePage, setActivePage] = useState<SettingsPageType>('account');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); }
  }, [user, authLoading, router]);

  const handleLogout = () => { logout(); router.push('/login'); };

  if (authLoading || !user) {
    return <div className="h-screen flex items-center justify-center bg-bg-primary text-text-secondary">加载中...</div>;
  }

  return (
    <div className="h-screen flex bg-bg-primary">
      <SettingsSidebar
        activePage={activePage}
        onPageChange={setActivePage}
        onBack={() => router.push('/dashboard')}
        user={user}
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-[720px]">
          {activePage === 'account' && <AccountProfile user={user} />}
          {activePage === 'organization' && <OrganizationTabContent currentUserId={user.id} />}
          {activePage === 'claude-code' && <ClaudeCodeConfig />}
        </div>
      </div>
    </div>
  );
}