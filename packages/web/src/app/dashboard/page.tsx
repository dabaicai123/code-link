'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Workspace } from '@/components/workspace';
import { CreateProjectDialog } from '@/components/create-project-dialog';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const handleLogout = () => { logout(); router.push('/login'); };

  if (authLoading || !user) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>加载中...</div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <Sidebar
        user={user}
        activeProjectId={activeProject?.id ?? null}
        refreshKey={projectRefreshKey}
        onProjectSelect={setActiveProject}
        onCreateProject={() => setIsDialogOpen(true)}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Workspace project={activeProject} userId={user.id} wsUrl={process.env.NEXT_PUBLIC_WS_URL} />
      </div>
      <CreateProjectDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={(project) => { setActiveProject(project); setProjectRefreshKey(k => k + 1); setIsDialogOpen(false); }}
      />
    </div>
  );
}