'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { useOrganizationStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import type { Project, User } from '@/types';
import { useSidebarProjects } from '@/hooks/use-sidebar-projects';

interface SidebarProps {
  user: User;
  activeProjectId: number | null;
  refreshKey?: number;
  onProjectSelect: (project: Project) => void;
  onCreateProject: () => void;
  onLogout: () => void;
  onSettings: () => void;
}

export function Sidebar({ user, activeProjectId, refreshKey, onProjectSelect, onCreateProject, onLogout, onSettings }: SidebarProps) {
  const organizations = useOrganizationStore((s) => s.organizations);
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const setCurrentOrganization = useOrganizationStore((s) => s.setCurrentOrganization);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  const { runningProjects, stoppedProjects, loading, refetch } = useSidebarProjects({
    organizationId: currentOrganization?.id ?? null,
    refreshKey,
  });

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

  return (
    <div className="w-[var(--sidebar-width)] h-full bg-bg-secondary flex flex-col border-r border-border-default">
      <div className="px-4 py-3.5 border-b border-border-default">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-accent-primary text-white rounded-lg flex items-center justify-center font-bold text-sm">C</div>
          <div>
            <div className="text-text-primary font-bold text-[13px]">Code Link</div>
            <div className="text-text-muted text-[11px]">v1.0.0</div>
          </div>
        </div>
      </div>

      {/* 组织选择器 — outside scrollable area */}
      <div className="px-3 pt-3 pb-2">
        <div>
          <div
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className={cn(
              "w-full px-3 py-2 border border-border-default rounded-lg",
              "text-[13px] cursor-pointer flex items-center justify-between relative",
              "transition-colors duration-150",
              showOrgDropdown ? "bg-accent-primary/5" : "bg-bg-card"
            )}
          >
            <span className="text-text-primary font-medium">{currentOrganization?.name || '选择组织'}</span>
            <span className="text-text-muted text-[10px]">{showOrgDropdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
          </div>

          {showOrgDropdown && organizations.length > 0 && (
            <div className="absolute w-[calc(var(--sidebar-width)-24px)] mt-1 bg-bg-card border border-border-default rounded-lg z-[100]">
              {organizations.map((org, index) => (
                <div
                  key={org.id}
                  onClick={() => {
                    setCurrentOrganization(org);
                    setShowOrgDropdown(false);
                  }}
                  className={cn(
                    "px-3 py-2.5 text-[13px] cursor-pointer transition-colors duration-150 hover:bg-bg-hover",
                    currentOrganization?.id === org.id ? "text-accent-primary" : "text-text-primary",
                    index !== organizations.length - 1 && "border-b border-border-default"
                  )}
                >
                  {org.name}
                  {currentOrganization?.id === org.id && <Check className="w-3 h-3 ml-2 text-accent-primary" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新建项目按钮 — outside scrollable area */}
      <div className="px-3 pb-3">
        <button
          onClick={onCreateProject}
          className="w-full h-9 border border-dashed border-border-light rounded-lg text-text-muted text-[13px] font-medium hover:bg-bg-hover hover:border-border-default hover:text-text-secondary transition-all"
        >
          + 新建项目
        </button>
      </div>

      {/* 项目列表 — scrollable area */}
      <div className="flex-1 px-3 overflow-y-auto">
        {loading ? (
          <div className="text-text-muted text-center p-5">加载中...</div>
        ) : (
          <>
            {runningProjects.length > 0 && (
              <div className="mb-4">
                <div className="text-text-muted text-[11px] mb-2 px-2.5 uppercase tracking-wide">
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
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}

            {stoppedProjects.length > 0 && (
              <div className="mb-4">
                <div className="text-text-muted text-[11px] mb-2 px-2.5 uppercase tracking-wide">
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
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <UserSection user={user} onLogout={onLogout} onSettings={onSettings} />
    </div>
  );
}