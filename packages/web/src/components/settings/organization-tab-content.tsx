'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Organization, OrganizationDetail } from '@/types/organization';
import type { OrgRole } from '@/types/user';
import { CreateOrganizationDialog } from '@/components/organization/create-organization-dialog';
import { OrganizationDetailPanel } from './organization-detail-panel';
import { Button } from '@/components/ui/button';

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  developer: 'Developer',
  member: 'Member',
};

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'var(--accent-primary)',
  developer: 'var(--status-success)',
  member: 'var(--text-secondary)',
};

interface OrganizationTabContentProps {
  currentUserId: number;
}

export function OrganizationTabContent({ currentUserId }: OrganizationTabContentProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => { fetchOrganizations(); }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载组织列表失败');
    } finally { setLoading(false); }
  };

  const fetchOrganizationDetail = async (orgId: number) => {
    try {
      const data = await api.getOrganization(orgId);
      setSelectedOrg(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '加载组织详情失败');
    }
  };

  const handleSelectOrg = (org: Organization) => { fetchOrganizationDetail(org.id); };

  const handleCreateSuccess = (org: Organization) => {
    setIsCreateDialogOpen(false);
    fetchOrganizations();
    fetchOrganizationDetail(org.id);
  };

  const handleCloseDetail = () => { setSelectedOrg(null); };

  const handleRefresh = async () => {
    await fetchOrganizations();
    if (selectedOrg) await fetchOrganizationDetail(selectedOrg.id);
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-text-secondary">加载中...</div>;
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive p-5">
        {error}
        <Button onClick={fetchOrganizations} variant="secondary" className="ml-3">重试</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 左侧组织列表 */}
      <div className="w-[280px] border-r border-border-default flex flex-col bg-bg-secondary">
        <div className="p-4 border-b border-border-default">
          <Button onClick={() => setIsCreateDialogOpen(true)} variant="default" className="w-full">+ 创建组织</Button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {organizations.length === 0 ? (
            <div className="text-center py-10 px-4 text-text-secondary">您尚未加入任何组织</div>
          ) : (
            <div className="grid gap-2">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className={`p-3 border rounded-md cursor-pointer transition-all duration-150 ${
                    selectedOrg?.id === org.id
                      ? 'bg-bg-primary border-accent-primary'
                      : 'bg-bg-card border-border-default'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-medium">{org.name}</span>
                    {org.role && (
                      <span
                        className="py-0.5 px-1.5 rounded-md text-[10px]"
                        style={{
                          backgroundColor: `${ROLE_COLORS[org.role]}20`,
                          border: `1px solid ${ROLE_COLORS[org.role]}`,
                          color: ROLE_COLORS[org.role],
                        }}
                      >
                        {ROLE_LABELS[org.role]}
                      </span>
                    )}
                  </div>
                  <div className="text-text-secondary text-[11px] mt-1">
                    创建于 {new Date(org.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧详情面板 */}
      <OrganizationDetailPanel
        organization={selectedOrg}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
        onClose={handleCloseDetail}
      />

      <CreateOrganizationDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}