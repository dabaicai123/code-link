'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Organization, OrganizationDetail } from '@/types/organization';
import type { OrganizationInvitation } from '@/types/invitation';
import type { OrgRole } from '@/types/user';
import { CreateOrganizationDialog } from '@/components/organization/create-organization-dialog';
import { InviteMemberDialog } from '@/components/organization/invite-member-dialog';
import { MembersTab } from './members-tab';
import { InvitationsTab } from './invitations-tab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [showInvitations, setShowInvitations] = useState(false);

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
      setOrgName(data.name);
      setIsEditingName(false);
      setDetailError(null);
      loadInvitations(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '加载组织详情失败');
    }
  };

  const loadInvitations = async (org?: OrganizationDetail) => {
    const organization = org || selectedOrg;
    if (!organization || organization.role !== 'owner') return;
    try {
      const data = await api.getOrganizationInvitations(organization.id);
      setInvitations(data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    }
  };

  const handleSelectOrg = (org: Organization) => { fetchOrganizationDetail(org.id); };

  const handleCreateSuccess = (org: Organization) => {
    setIsCreateDialogOpen(false);
    fetchOrganizations();
    fetchOrganizationDetail(org.id);
  };

  const handleRefresh = async () => {
    await fetchOrganizations();
    if (selectedOrg) await fetchOrganizationDetail(selectedOrg.id);
  };

  const handleSaveName = async () => {
    if (!orgName.trim()) { setDetailError('组织名称不能为空'); return; }
    if (!selectedOrg) return;
    setIsSaving(true);
    setDetailError(null);
    try {
      await api.updateOrganization(selectedOrg.id, orgName.trim());
      await handleRefresh();
      setIsEditingName(false);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : '修改组织名称失败');
    } finally { setIsSaving(false); }
  };

  const handleCancelEditName = () => {
    if (!selectedOrg) return;
    setIsEditingName(false);
    setOrgName(selectedOrg.name);
    setDetailError(null);
  };

  const handleInviteSuccess = (invitation: OrganizationInvitation) => {
    setIsInviteDialogOpen(false);
    setInvitations([...invitations, invitation]);
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!selectedOrg) return;
    if (!confirm('确定要取消这个邀请吗？')) return;
    try {
      await api.cancelInvitation(selectedOrg.id, invId);
      setInvitations(invitations.filter((inv) => inv.id !== invId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '取消邀请失败');
    }
  };

  const handleLeaveOrganization = async () => {
    if (!selectedOrg) return;
    if (!confirm('确定要退出该组织吗？')) return;
    try {
      await api.removeMember(selectedOrg.id, currentUserId);
      setSelectedOrg(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '退出组织失败');
    }
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
    <>
      <h1 className="text-xl font-bold text-text-primary">组织管理</h1>
      <p className="text-sm text-text-muted mb-6">管理您加入的组织和团队成员</p>

      {organizations.length === 0 ? (
        <div className="text-center py-10 px-4 text-text-secondary">您尚未加入任何组织</div>
      ) : (
        <div>
          {organizations.map((org) => (
            <div
              key={org.id}
              onClick={() => handleSelectOrg(org)}
              className={`bg-bg-card border rounded-[var(--corner-lg)] p-4 mb-2 cursor-pointer transition-all duration-150 flex items-center gap-3 hover:shadow-[var(--elev-warm-sm)] ${
                selectedOrg?.id === org.id
                  ? 'border-accent-primary shadow-[var(--elev-warm)]'
                  : 'border-border-default'
              }`}
            >
              <div className="w-10 h-10 rounded-[var(--corner-md)] bg-accent-light flex items-center justify-center text-accent-primary text-base font-bold">
                {org.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">{org.name}</div>
                <div className="text-[11px] text-text-muted">
                  {org.role ? `${ROLE_LABELS[org.role]} · ` : ''}创建于 {new Date(org.createdAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
              {org.role && (
                <span
                  className="py-0.5 px-1.5 rounded-md text-[10px] border"
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
          ))}
        </div>
      )}

      <button
        onClick={() => setIsCreateDialogOpen(true)}
        className="w-full h-[var(--size-control-md)] border border-dashed border-border-light rounded-[var(--corner-md)] bg-none text-text-muted text-[13px] font-medium cursor-pointer flex items-center justify-center gap-1.5 hover:border-accent-primary hover:text-accent-primary hover:bg-accent-light transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        创建新组织
      </button>

      {selectedOrg && (
        <div className="mt-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-default mb-4">
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <>
                  <Input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-[200px]" maxLength={100} />
                  <Button onClick={handleSaveName} disabled={isSaving} variant="default" className="py-1 px-2 text-xs">{isSaving ? '保存中...' : '保存'}</Button>
                  <Button onClick={handleCancelEditName} disabled={isSaving} variant="secondary" className="py-1 px-2 text-xs">取消</Button>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-[var(--corner-md)] bg-accent-light flex items-center justify-center text-accent-primary text-sm font-bold">
                    {selectedOrg.name.charAt(0)}
                  </div>
                  <h2 className="text-lg font-bold text-text-primary">{selectedOrg.name}</h2>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {selectedOrg.role === 'owner' && (
                <>
                  <Button onClick={() => setIsInviteDialogOpen(true)} variant="default" className="gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    邀请成员
                  </Button>
                  {!isEditingName && (
                    <Button onClick={() => setIsEditingName(true)} variant="outline">编辑名称</Button>
                  )}
                </>
              )}
              {selectedOrg.role !== 'owner' && (
                <Button onClick={handleLeaveOrganization} variant="destructive">退出组织</Button>
              )}
            </div>
          </div>

          {detailError && (
            <div className="bg-destructive/10 border border-destructive rounded-md p-3 text-destructive text-[13px] mb-4">{detailError}</div>
          )}

          <InvitationsTab
            invitations={invitations}
            show={showInvitations}
            onToggle={() => setShowInvitations(!showInvitations)}
            onCancel={handleCancelInvitation}
          />

          <div className="text-sm font-semibold text-text-secondary mb-3">
            成员 ({selectedOrg.members.length})
          </div>

          <MembersTab organization={selectedOrg} currentUserId={currentUserId} onRefresh={handleRefresh} />

          <InviteMemberDialog
            organizationId={selectedOrg.id}
            isOpen={isInviteDialogOpen}
            onClose={() => setIsInviteDialogOpen(false)}
            onSuccess={handleInviteSuccess}
          />
        </div>
      )}

      <CreateOrganizationDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}