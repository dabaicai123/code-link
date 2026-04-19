'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api, ApiError, OrganizationDetail, OrganizationInvitation, OrgRole, OrganizationMember } from '@/lib/api';
import { OrganizationMemberList } from '@/components/organization-member-list';
import { InviteMemberDialog } from '@/components/invite-member-dialog';

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

  // 当 organization 变化时，重置状态并加载邀请
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}
      >
        选择一个组织查看详情
      </div>
    );
  }

  const isOwner = organization.role === 'owner';

  const handleEditName = () => {
    setIsEditingName(true);
    setError(null);
  };

  const handleSaveName = async () => {
    if (!orgName.trim()) {
      setError('组织名称不能为空');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.updateOrganization(organization.id, orgName.trim());
      await onRefresh();
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改组织名称失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setOrgName(organization.name);
    setError(null);
  };

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
    <div
      style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto',
        borderLeft: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* 头部：名称 + 邀请按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditingName ? (
            <>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input"
                style={{ width: '200px' }}
                maxLength={100}
              />
              <button
                onClick={handleSaveName}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleCancelEditName}
                disabled={isSaving}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                取消
              </button>
            </>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>
                {organization.name}
              </h2>
              {isOwner && (
                <button
                  onClick={handleEditName}
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '11px' }}
                >
                  编辑
                </button>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwner && (
            <button onClick={() => setIsInviteDialogOpen(true)} className="btn btn-primary">
              邀请成员
            </button>
          )}
          {!isOwner && (
            <button
              onClick={handleLeaveOrganization}
              className="btn btn-secondary"
              style={{ color: 'var(--status-error)' }}
            >
              退出组织
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-error)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* 待处理邀请（Owner 可见） */}
      {isOwner && invitations.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}>
              待处理邀请 ({invitations.length})
            </h3>
            <button onClick={() => setShowInvitations(!showInvitations)} className="btn btn-secondary">
              {showInvitations ? '收起' : '展开'}
            </button>
          </div>

          {showInvitations && (
            <div style={{ display: 'grid', gap: '8px' }}>
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    padding: '10px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{inv.email}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      角色: {inv.role} | 邀请时间: {new Date(inv.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(inv.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    取消邀请
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 成员列表 */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}
      >
        <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', margin: '0 0 12px 0' }}>
          成员列表
        </h3>
        <OrganizationMemberList
          organizationId={organization.id}
          members={organization.members}
          currentUserId={currentUserId}
          currentUserRole={organization.role || 'member'}
          onRefresh={onRefresh}
        />
      </div>

      {/* 邀请成员弹窗 */}
      <InviteMemberDialog
        organizationId={organization.id}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
