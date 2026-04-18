'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { api, ApiError } from '@/lib/api';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  created_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface SidebarProps {
  user: User;
  activeProjectId: number | null;
  refreshKey?: number;
  onProjectSelect: (project: Project) => void;
  onCreateProject: () => void;
  onLogout: () => void;
}

export function Sidebar({ user, activeProjectId, refreshKey, onProjectSelect, onCreateProject, onLogout }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchProjects();
  }, [refreshKey]);

  const fetchProjects = async () => {
    try {
      const data = await api.get<Project[]>('/projects');
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (projectId: number) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const runningProjects = projects.filter((p) => p.status === 'running');
  const stoppedProjects = projects.filter((p) => p.status !== 'running');

  return (
    <div
      style={{
        width: 'var(--sidebar-width)',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>Code Link</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>v1.0.0</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <>
            {runningProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  运行中 ({runningProjects.length})
                </div>
                {runningProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    isExpanded={expandedProjectIds.has(project.id)}
                    onToggleExpand={() => toggleExpand(project.id)}
                    onClick={() => onProjectSelect(project)}
                    onRefresh={fetchProjects}
                  />
                ))}
              </div>
            )}

            {stoppedProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  已停止 ({stoppedProjects.length})
                </div>
                {stoppedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    isExpanded={expandedProjectIds.has(project.id)}
                    onToggleExpand={() => toggleExpand(project.id)}
                    onClick={() => onProjectSelect(project)}
                    onRefresh={fetchProjects}
                  />
                ))}
              </div>
            )}

            <button
              onClick={onCreateProject}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px dashed var(--border-light)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + 新建项目
            </button>
          </>
        )}
      </div>

      <UserSection user={user} onLogout={onLogout} />
    </div>
  );
}