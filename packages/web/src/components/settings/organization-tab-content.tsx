'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api, ApiError, Organization, OrganizationDetail, OrgRole } from '@/lib/api';
import { CreateOrganizationDialog } from '@/components/create-organization-dialog';
import { OrganizationDetailPanel } from './organization-detail-panel';

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  developer: 'Developer',
  member: 'Member',
};

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'var(--accent-color)',
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

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载组织列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationDetail = async (orgId: number) => {
    try {
      const data = await api.getOrganization(orgId);
      setSelectedOrg(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '加载组织详情失败');
    }
  };

  const handleSelectOrg = (org: Organization) => {
    fetchOrganizationDetail(org.id);
  };

  const handleCreateSuccess = (org: Organization) => {
    setIsCreateDialogOpen(false);
    fetchOrganizations();
    // 自动选中新创建的组织
    fetchOrganizationDetail(org.id);
  };

  const handleCloseDetail = () => {
    setSelectedOrg(null);
  };

  const handleRefresh = async () => {
    await fetchOrganizations();
    if (selectedOrg) {
      await fetchOrganizationDetail(selectedOrg.id);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--status-error)',
          padding: '20px',
        }}
      >
        {error}
        <button onClick={fetchOrganizations} className="btn btn-secondary" style={{ marginLeft: '12px' }}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* 左侧组织列表 */}
      <div
        style={{
          width: '280px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={() => setIsCreateDialogOpen(true)} className="btn btn-primary" style={{ width: '100%' }}>
            + 创建组织
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {organizations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
              您尚未加入任何组织
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  style={{
                    padding: '12px',
                    backgroundColor: selectedOrg?.id === org.id ? 'var(--bg-primary)' : 'var(--bg-card)',
                    border: `1px solid ${selectedOrg?.id === org.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
                      {org.name}
                    </span>
                    {org.role && (
                      <span
                        style={{
                          padding: '2px 6px',
                          backgroundColor: `${ROLE_COLORS[org.role]}20`,
                          border: `1px solid ${ROLE_COLORS[org.role]}`,
                          borderRadius: 'var(--radius-sm)',
                          color: ROLE_COLORS[org.role],
                          fontSize: '10px',
                        }}
                      >
                        {ROLE_LABELS[org.role]}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px' }}>
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

      {/* 创建组织弹窗 */}
      <CreateOrganizationDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
