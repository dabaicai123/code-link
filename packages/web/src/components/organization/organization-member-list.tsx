'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { OrganizationMember } from '@/types/organization';
import type { OrgRole } from '@/types/user';
import { ROLE_LABELS, ROLE_COLORS, ROLE_OPTIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      <div className="text-text-secondary text-[13px] mb-3">
        共 {members.length} 名成员
      </div>

      {error && (
        <div className="p-3 bg-accent-light border border-accent-primary rounded-md text-accent-primary text-[13px] mb-3">
          {error}
        </div>
      )}

      <div className="grid gap-2">
        {members.map((member) => {
          const isEditing = editingUserId === member.id;
          const isCurrentUser = member.id === currentUserId;

          return (
            <div
              key={member.id}
              className="p-3 bg-bg-card border border-border-default rounded-md flex items-center gap-3"
            >
              {/* Avatar */}
              <div className="w-8 h-8 bg-accent-primary rounded-md flex items-center justify-center text-white text-[13px] font-medium">
                {(member.name || '?').charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-[13px] font-medium">
                  {member.name}
                  {isCurrentUser && (
                    <span className="text-text-secondary text-[11px] ml-1.5">
                      (我)
                    </span>
                  )}
                </div>
                <div className="text-text-secondary text-[12px]">
                  {member.email}
                </div>
              </div>

              {/* Role */}
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
                    className="w-[120px] px-2 py-1.5 bg-bg-primary border border-border-default rounded-md text-text-primary text-[13px]"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => handleSaveRole(member.id)}
                    disabled={isUpdating}
                    variant="default"
                    size="sm"
                  >
                    {isUpdating ? '保存中...' : '保存'}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    disabled={isUpdating}
                    variant="secondary"
                    size="sm"
                  >
                    取消
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: `${ROLE_COLORS[member.role]}20`,
                      borderColor: ROLE_COLORS[member.role],
                      color: ROLE_COLORS[member.role],
                    }}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>

                  {canManageMembers && !isCurrentUser && (
                    <>
                      <Button
                        onClick={() => handleEditRole(member.id, member.role)}
                        variant="secondary"
                        size="sm"
                      >
                        修改角色
                      </Button>
                      <Button
                        onClick={() => handleRemoveMember(member.id, member.role)}
                        variant="secondary"
                        size="sm"
                        className="text-destructive"
                      >
                        移除
                      </Button>
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