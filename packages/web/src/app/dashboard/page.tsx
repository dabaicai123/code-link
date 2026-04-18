'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Workspace } from '@/components/workspace';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { api } from '@/lib/api';

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
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // 选择项目时，自动启动容器
  const handleProjectSelect = useCallback(async (project: Project) => {
    // 如果容器未运行，先启动容器，再设置 activeProject
    if (project.status !== 'running') {
      setIsStarting(true);
      try {
        await api.post(`/projects/${project.id}/container/start`);
        // 容器启动成功后再设置 activeProject
        setActiveProject({ ...project, status: 'running' });
        setProjectRefreshKey(k => k + 1);
      } catch (err: any) {
        if (err?.response?.data?.code === 'CLAUDE_CONFIG_MISSING') {
          alert(err.response.data.error);
          router.push('/settings');
        } else {
          console.error('启动容器失败:', err);
        }
      } finally {
        setIsStarting(false);
      }
    } else {
      // 容器已运行，直接设置
      setActiveProject(project);
    }
  }, [router]);

  // 重启容器
  const handleRestart = useCallback(async () => {
    if (!activeProject) return;

    setIsStarting(true);
    // 先清除 activeProject，避免 WebSocket 重连
    setActiveProject(null);

    try {
      // 如果容器正在运行，先停止
      if (activeProject.status === 'running') {
        try {
          await api.post(`/projects/${activeProject.id}/container/stop`);
        } catch (err) {
          // 忽略停止错误（容器可能已经停止）
        }
      }
      // 启动容器
      await api.post(`/projects/${activeProject.id}/container/start`);
      setActiveProject({ ...activeProject, status: 'running' });
      setProjectRefreshKey(k => k + 1);
    } catch (err: any) {
      if (err?.response?.data?.code === 'CLAUDE_CONFIG_MISSING') {
        alert(err.response.data.error);
        router.push('/settings');
      } else {
        console.error('重启容器失败:', err);
        // 恢复原状态
        setActiveProject(activeProject);
      }
    } finally {
      setIsStarting(false);
    }
  }, [activeProject, router]);

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
        onProjectSelect={handleProjectSelect}
        onCreateProject={() => setIsDialogOpen(true)}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isStarting ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>正在启动容器...</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>请稍候</div>
            </div>
          </div>
        ) : (
          <Workspace
            project={activeProject}
            userId={user.id}
            wsUrl={process.env.NEXT_PUBLIC_WS_URL}
            onRestart={handleRestart}
          />
        )}
      </div>
      <CreateProjectDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={async (project) => {
          setIsDialogOpen(false);
          // 新建项目后自动启动容器
          handleProjectSelect(project);
        }}
      />
    </div>
  );
}