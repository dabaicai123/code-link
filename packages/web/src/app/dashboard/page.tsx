'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useLogout, useCurrentUser, useProjects, useStartContainer } from '@/lib/queries';
import type { Project } from '@/types';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useOrganizationStore } from '@/lib/stores';
import { Sidebar } from '@/components/sidebar';
import { Workspace } from '@/components/workspace';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { Loading } from '@/components/ui/loading';
import { ApiError } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { isLoading: authLoading } = useCurrentUser();
  const currentOrg = useOrganizationStore((s) => s.currentOrganization);

  // 使用 TanStack Query
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const startContainer = useStartContainer();

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // 选择项目时，自动启动容器
  const handleProjectSelect = useCallback(async (project: Project) => {
    if (project.status !== 'running') {
      setIsStarting(true);
      try {
        await startContainer.mutateAsync(project.id);
        setActiveProject({ ...project, status: 'running' });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '启动容器失败';
        toast.error(message);
        if (err instanceof ApiError && err.code === 40002) {
          router.push('/settings');
        }
      } finally {
        setIsStarting(false);
      }
    } else {
      setActiveProject(project);
    }
  }, [startContainer, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authLoading || !user) {
    return <Loading text="加载中..." />;
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        user={user}
        activeProjectId={activeProject?.id ?? null}
        onProjectSelect={handleProjectSelect}
        onCreateProject={() => setIsDialogOpen(true)}
        onLogout={handleLogout}
      />
      <div className="flex-1 overflow-hidden relative">
        {isStarting ? (
          <Loading text="正在启动容器..." />
        ) : (
          <Workspace
            project={activeProject}
            userId={user.id}
            wsUrl={process.env.NEXT_PUBLIC_WS_URL}
          />
        )}
      </div>
      <CreateProjectDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={async (project) => {
          setIsDialogOpen(false);
          handleProjectSelect(project);
        }}
      />
    </div>
  );
}
