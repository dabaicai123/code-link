'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, OrganizationDetail, OrganizationInvitation, OrgRole } from '@/lib/api';
import { OrganizationMemberList } from '@/components/organization-member-list';
import { InviteMemberDialog } from '@/components/invite-member-dialog';

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = parseInt(params.id as string, 10);
  const { user, loading: authLoading, logout } = useAuth();

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && orgId) {
      fetchOrganization();
    }
  }, [user, orgId]);

  const fetchOrganization = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrganization(orgId);
      setOrganization(data);
      setOrgName(data.name);

      // 如果是 owner，加载邀请列表
      if (data.role === 'owner') {
        const invData = await api.getOrganizationInvitations(orgId);
        setInvitations(invData);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载组织详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleInviteSuccess = (invitation: OrganizationInvitation) => {
    setIsInviteDialogOpen(false);
    setInvitations([...invitations, invitation]);
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!confirm('确定要取消这个邀请吗？')) return;

    try {
      await api.cancelInvitation(orgId, invId);
      setInvitations(invitations.filter((inv) => inv.id !== invId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '取消邀请失败');
    }
  };

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
      const updated = await api.updateOrganization(orgId, orgName.trim());
      setOrganization({ ...organization!, name: updated.name });
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改组织名称失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setOrgName(organization?.name || '');
    setError(null);
  };

  const handleDeleteOrganization = async () => {
    if (!organization) return;

    // 检查组织下是否有项目
    if (organization.members && organization.members.length > 1) {
      alert('组织下还有其他成员，请先移除所有成员');
      return;
    }

    if (!confirm('确定要删除这个组织吗？此操作不可恢复。')) return;
    if (!confirm('再次确认：删除组织将同时删除组织下的所有项目数据。')) return;

    setIsDeleting(true);
    try {
      await api.deleteOrganization(orgId);
      router.push('/organizations');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '删除组织失败');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}>
        加载中...
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}>
        加载中...
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{ color: 'var(--status-error)', fontSize: '16px' }}>
          {error || '组织不存在'}
        </div>
        <button onClick={() => router.push('/organizations')} className="btn btn-primary">
          返回组织列表
        </button>
      </div>
    );
  }

  const currentUserRole = organization.role || 'member';
  const isOwner = currentUserRole === 'owner';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/organizations')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← 返回
          </button>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {organization.name}
                {isOwner && (
                  <button
                    onClick={handleEditName}
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    编辑
                  </button>
                )}
              </div>
            )}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'var(--accent-color)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{user.name}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              marginLeft: '8px',
            }}
          >
            退出
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-error)',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* 成员管理 */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: 0 }}>成员列表</h2>
            {isOwner && (
              <button onClick={() => setIsInviteDialogOpen(true)} className="btn btn-primary">
                邀请成员
              </button>
            )}
          </div>

          <OrganizationMemberList
            organizationId={orgId}
            members={organization.members}
            currentUserId={user.id}
            currentUserRole={currentUserRole}
            onRefresh={fetchOrganization}
          />
        </div>

        {/* 待处理邀请（仅 owner 可见） */}
        {isOwner && invitations.length > 0 && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: 0 }}>
                待处理邀请 ({invitations.length})
              </h2>
              <button
                onClick={() => setShowInvitations(!showInvitations)}
                className="btn btn-secondary"
              >
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
                        角色: {inv.role} | 邀请时间: {new Date(inv.created_at).toLocaleDateString('zh-CN')}
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

        {/* 删除组织（仅 owner 可见） */}
        {isOwner && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
          }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: '0 0 12px 0' }}>危险操作</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
              删除组织将同时删除组织下的所有项目和成员数据。此操作不可恢复。
            </div>
            <button
              onClick={handleDeleteOrganization}
              disabled={isDeleting}
              className="btn btn-secondary"
              style={{ color: 'var(--status-error)' }}
            >
              {isDeleting ? '删除中...' : '删除组织'}
            </button>
          </div>
        )}
      </div>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        organizationId={orgId}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
