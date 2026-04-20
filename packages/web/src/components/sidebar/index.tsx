'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { api, ApiError, Organization } from '@/lib/api';
import { useOrganizationStore } from '@/lib/stores';
import { useOrganizations } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Project, User } from '@/types';

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
  const organizations = useOrganizationStore((s) => s.organizations);
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const setCurrentOrganization = useOrganizationStore((s) => s.setCurrentOrganization);
  const { isLoading: orgLoading } = useOrganizations();
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
    <div className="sidebar-container">
      <div className="p-3.5 border-b border-border">
        <div className="text-accent-primary font-semibold text-[13px]">Code Link</div>
        <div className="text-muted-foreground text-[11px] mt-0.5">v1.0.0</div>
      </div>

      <div className={cn(
        "flex-1 p-3",
        projects.length > 10 ? "overflow-auto" : "overflow-visible"
      )}>
        {/* 组织选择器 */}
        <div className="mb-3">
          <div
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className={cn(
              "w-full px-3 py-2.5 border border-border rounded-md",
              "text-[13px] cursor-pointer flex items-center justify-between relative",
              "transition-colors duration-150",
              showOrgDropdown ? "bg-primary/5" : "bg-card"
            )}
          >
            <span>{currentOrganization?.name || '选择组织'}</span>
            <span className="text-muted-foreground text-[10px]">{showOrgDropdown ? '▲' : '▼'}</span>
          </div>

          {showOrgDropdown && organizations.length > 0 && (
            <div className="absolute w-[calc(var(--sidebar-width)-24px)] mt-1 bg-card border border-border rounded-md z-[100]">
              {organizations.map((org, index) => (
                <div
                  key={org.id}
                  onClick={() => {
                    setCurrentOrganization(org);
                    setShowOrgDropdown(false);
                    setLoading(true);
                  }}
                  className={cn(
                    "px-3 py-2.5 text-[13px] cursor-pointer transition-colors duration-150",
                    currentOrganization?.id === org.id ? "text-accent-primary" : "text-primary",
                    index !== organizations.length - 1 && "border-b border-border"
                  )}
                >
                  {org.name}
                  {currentOrganization?.id === org.id && <span className="ml-2 text-[11px]">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 导航入口 */}
        <div className="mb-3">
          <Button
            variant="secondary"
            onClick={() => router.push('/settings')}
            className="w-full justify-between"
          >
            <span>组织设置</span>
            <span className="text-muted-foreground text-[11px]">→</span>
          </Button>

          {invitationCount && invitationCount > 0 && (
            <Button
              variant="outline"
              onClick={() => router.push('/invitations')}
              className="w-full justify-between mt-1.5 border-accent-primary text-accent-primary"
            >
              <span>待处理邀请</span>
              <span className="bg-accent-primary text-white px-1.5 py-0.5 rounded-sm text-[11px]">
                {invitationCount}
              </span>
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={onCreateProject}
          className="w-full mb-4 border border-dashed border-border-light text-muted-foreground"
        >
          + 新建项目
        </Button>

        {loading ? (
          <div className="text-muted-foreground text-center p-5">加载中...</div>
        ) : (
          <>
            {runningProjects.length > 0 && (
              <div className="mb-4">
                <div className="text-muted-foreground text-[11px] mb-2 pl-2.5">
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
              <div className="mb-4">
                <div className="text-muted-foreground text-[11px] mb-2 pl-2.5">
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