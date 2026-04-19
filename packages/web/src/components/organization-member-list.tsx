'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, OrganizationMember, OrgRole } from '@/lib/api';
import { ROLE_LABELS, ROLE_COLORS, ROLE_OPTIONS } from '@/lib/constants';

interface OrganizationMemberListProps {
  organizationId: number;
  members: OrganizationMember[];
  currentUserId: number;
  currentUserRole: OrgRole;
  onRefresh: () => void;
}

export function OrganizationMemberList({
  organizationId,
  members,
  currentUserId,
  currentUserRole,
  onRefresh,
}: OrganizationMemberListProps) {
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrgRole>('member');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageMembers = currentUserRole === 'owner';

  const handleEditRole = (userId: number, currentRole: OrgRole) => {
    setEditingUserId(userId);
    setSelectedRole(currentRole);
    setError(null);
  };

  const handleSaveRole = async (userId: number) => {
    setIsUpdating(true);
    setError(null);

    try {
      await api.updateMemberRole(organizationId, userId, selectedRole);
      setEditingUserId(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改角色失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: number, memberRole: OrgRole) => {
    if (userId === currentUserId) {
      toast.error('不能移除自己');
      return;
    }

    // 检查是否是最后一个 owner
    const ownerCount = members.filter(m => m.role === 'owner').length;
    if (memberRole === 'owner' && ownerCount <= 1) {
      toast.error('不能移除最后一个 owner');
      return;
    }

    if (!confirm('确定要移除该成员吗？')) return;

    try {
      await api.removeMember(organizationId, userId);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '移除成员失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setError(null);
  };

  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
        共 {members.length} 名成员
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid var(--status-error)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-error)',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px' }}>
        {members.map((member) => {
          const isEditing = editingUserId === member.id;
          const isCurrentUser = member.id === currentUserId;

          return (
            <div
              key={member.id}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--accent-color)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                  {member.name}
                  {isCurrentUser && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '6px' }}>
                      (我)
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  {member.email}
                </div>
              </div>

              {/* Role */}
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
                    className="input"
                    style={{ width: '120px', padding: '6px 8px' }}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSaveRole(member.id)}
                    disabled={isUpdating}
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    {isUpdating ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isUpdating}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      backgroundColor: `${ROLE_COLORS[member.role]}20`,
                      border: `1px solid ${ROLE_COLORS[member.role]}`,
                      borderRadius: 'var(--radius-sm)',
                      color: ROLE_COLORS[member.role],
                      fontSize: '11px',
                    }}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>

                  {canManageMembers && !isCurrentUser && (
                    <>
                      <button
                        onClick={() => handleEditRole(member.id, member.role)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        修改角色
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.role)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--status-error)' }}
                      >
                        移除
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
