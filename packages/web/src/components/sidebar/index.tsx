'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { api, ApiError, Organization } from '@/lib/api';
import { useOrganization } from '@/lib/organization-context';

interface Project {
  id: number;
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  createdAt: string;
}

interface User {
  id: number;
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
  invitationCount?: number;
}

export function Sidebar({ user, activeProjectId, refreshKey, onProjectSelect, onCreateProject, onLogout, invitationCount }: SidebarProps) {
  const router = useRouter();
  const { organizations, currentOrganization, setCurrentOrganization, loading: orgLoading } = useOrganization();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  useEffect(() => {
    if (!orgLoading && currentOrganization) {
      fetchProjects();
    }
  }, [refreshKey, currentOrganization, orgLoading]);

  const fetchProjects = async () => {
    if (!currentOrganization) return;
    try {
      const data = await api.get<Project[]>(`/projects?organizationId=${currentOrganization.id}`);
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
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '13px' }}>Code Link</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>v1.0.0</div>
      </div>

      <div style={{ flex: 1, overflow: projects.length > 10 ? 'auto' : 'visible', padding: '12px' }}>
        {/* 组织选择器 */}
        <div style={{ marginBottom: '12px' }}>
          <div
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: showOrgDropdown ? 'var(--bg-primary)' : 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              transition: 'border-color 0.15s ease',
            }}
          >
            <span>{currentOrganization?.name || '选择组织'}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{showOrgDropdown ? '▲' : '▼'}</span>
          </div>

          {showOrgDropdown && organizations.length > 0 && (
            <div style={{
              position: 'absolute',
              width: 'calc(var(--sidebar-width) - 24px)',
              marginTop: '4px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              zIndex: 100,
            }}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => {
                    setCurrentOrganization(org);
                    setShowOrgDropdown(false);
                    setLoading(true);
                  }}
                  style={{
                    padding: '10px 12px',
                    color: currentOrganization?.id === org.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    borderBottom: org.id !== organizations[organizations.length - 1].id ? '1px solid var(--border-color)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {org.name}
                  {currentOrganization?.id === org.id && <span style={{ marginLeft: '8px', fontSize: '11px' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 导航入口 */}
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => router.push('/settings')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'space-between' }}
          >
            <span>组织设置</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>→</span>
          </button>

          {invitationCount && invitationCount > 0 && (
            <button
              onClick={() => router.push('/invitations')}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(217, 119, 87, 0.1)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-primary)',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '6px',
              }}
            >
              <span>待处理邀请</span>
              <span style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
              }}>
                {invitationCount}
              </span>
            </button>
          )}
        </div>

        <button
          onClick={onCreateProject}
          style={{
            width: '100%',
            padding: '10px',
            background: 'transparent',
            border: '1px dashed var(--border-light)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '13px',
            cursor: 'pointer',
            marginBottom: '16px',
            transition: 'all 0.15s ease',
          }}
        >
          + 新建项目
        </button>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <>
            {runningProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px', paddingLeft: '10px' }}>
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
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px', paddingLeft: '10px' }}>
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
          </>
        )}
      </div>

      <UserSection user={user} onLogout={onLogout} />
    </div>
  );
}