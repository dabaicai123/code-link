'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { OrganizationDetail, OrganizationMember } from '@/types/organization';
import type { OrganizationInvitation } from '@/types/invitation';
import type { OrgRole } from '@/types/user';
import { InviteMemberDialog } from '@/components/organization/invite-member-dialog';
import { MembersTab } from './members-tab';
import { InvitationsTab } from './invitations-tab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OrganizationDetailPanelProps {
  organization: OrganizationDetail | null;
  currentUserId: number;
  onRefresh: () => void;
  onClose: () => void;
}

export function OrganizationDetailPanel({
  organization,
  currentUserId,
  onRefresh,
  onClose,
}: OrganizationDetailPanelProps) {
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [showInvitations, setShowInvitations] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name);
      setIsEditingName(false);
      setError(null);
      loadInvitations();
    }
  }, [organization?.id]);

  const loadInvitations = async () => {
    if (!organization || organization.role !== 'owner') return;
    try {
      const data = await api.getOrganizationInvitations(organization.id);
      setInvitations(data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    }
  };

  if (!organization) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        选择一个组织查看详情
      </div>
    );
  }

  const isOwner = organization.role === 'owner';

  const handleSaveName = async () => {
    if (!orgName.trim()) { setError('组织名称不能为空'); return; }
    setIsSaving(true);
    setError(null);
    try {
      await api.updateOrganization(organization.id, orgName.trim());
      await onRefresh();
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改组织名称失败');
    } finally { setIsSaving(false); }
  };

  const handleCancelEditName = () => { setIsEditingName(false); setOrgName(organization.name); setError(null); };

  const handleInviteSuccess = (invitation: OrganizationInvitation) => {
    setIsInviteDialogOpen(false);
    setInvitations([...invitations, invitation]);
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!confirm('确定要取消这个邀请吗？')) return;
    try {
      await api.cancelInvitation(organization.id, invId);
      setInvitations(invitations.filter((inv) => inv.id !== invId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '取消邀请失败');
    }
  };

  const handleLeaveOrganization = async () => {
    if (!confirm('确定要退出该组织吗？')) return;
    try {
      await api.removeMember(organization.id, currentUserId);
      onClose();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '退出组织失败');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto border-l border-border-default bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border-default">
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <>
              <Input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-[200px]" maxLength={100} />
              <Button onClick={handleSaveName} disabled={isSaving} variant="default" className="py-1 px-2 text-xs">{isSaving ? '保存中...' : '保存'}</Button>
              <Button onClick={handleCancelEditName} disabled={isSaving} variant="secondary" className="py-1 px-2 text-xs">取消</Button>
            </>
          ) : (
            <>
              <h2 className="text-foreground text-lg m-0">{organization.name}</h2>
              {isOwner && <Button onClick={() => setIsEditingName(true)} variant="secondary" className="py-0.5 px-1.5 text-[11px]">编辑</Button>}
            </>
          )}
        </div>
        <div className="flex gap-2">
          {isOwner && <Button onClick={() => setIsInviteDialogOpen(true)} variant="default">邀请成员</Button>}
          {!isOwner && <Button onClick={handleLeaveOrganization} variant="secondary" className="text-destructive">退出组织</Button>}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-3 text-destructive text-[13px] mb-4">{error}</div>
      )}

      <InvitationsTab
        invitations={invitations}
        show={showInvitations}
        onToggle={() => setShowInvitations(!showInvitations)}
        onCancel={handleCancelInvitation}
      />

      <MembersTab organization={organization} currentUserId={currentUserId} onRefresh={onRefresh} />

      <InviteMemberDialog
        organizationId={organization.id}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}