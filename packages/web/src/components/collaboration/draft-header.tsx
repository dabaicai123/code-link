'use client';

import { useState } from 'react';
import type { Draft, DraftStatus, DraftMember } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';
import { draftsApi } from '../../lib/drafts-api';
import { OnlineUsers } from './online-users';
import type { DraftOnlineUser } from '@/lib/socket/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Alias for backward compatibility
type OnlineUser = DraftOnlineUser;

interface DraftHeaderProps {
  draft: Draft;
  members: DraftMember[];
  onlineUsers: OnlineUser[];
  currentUserId?: number;
  onStatusChange?: (status: DraftStatus) => void;
  onDelete?: () => void;
}

export function DraftHeader({
  draft,
  members,
  onlineUsers,
  currentUserId,
  onStatusChange,
  onDelete,
}: DraftHeaderProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (status: DraftStatus) => {
    try {
      setUpdating(true);
      await draftsApi.updateStatus(draft.id, status);
      onStatusChange?.(status);
      setShowStatusMenu(false);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个 Draft 吗？')) return;

    try {
      await draftsApi.delete(draft.id);
      onDelete?.();
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  };

  const isOwner = members.find(m => m.userId === currentUserId)?.role === 'owner';

  return (
    <div className="p-3 border-b border-border bg-secondary">
      {/* 标题和状态 */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="m-0 text-sm font-semibold text-foreground flex-1">
          {draft.title}
        </h3>

        {/* 状态选择器 */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            disabled={updating}
            className={cn(
              'text-xs',
              updating && 'opacity-70'
            )}
            style={{ backgroundColor: DRAFT_STATUS_COLORS[draft.status], color: 'white', borderColor: 'transparent' }}
          >
            {DRAFT_STATUS_LABELS[draft.status]}
            <span className="text-[8px] ml-1">▼</span>
          </Button>

          {showStatusMenu && (
            <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10 min-w-[120px]">
              {(Object.keys(DRAFT_STATUS_LABELS) as DraftStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className="block w-full px-3 py-2 text-xs text-left bg-transparent text-foreground hover:bg-hover cursor-pointer"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: DRAFT_STATUS_COLORS[status] }}
                  />
                  {DRAFT_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 更多操作 */}
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-xs border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            删除
          </Button>
        )}
      </div>

      {/* 在线用户 */}
      <div className="mb-2">
        <OnlineUsers users={onlineUsers} currentUserId={currentUserId} />
      </div>

      {/* 成员信息 */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMemberMenu(!showMemberMenu)}
          className="text-[10px]"
        >
          👥 {members.length} 成员
        </Button>
      </div>

      {/* 成员列表弹出 */}
      {showMemberMenu && (
        <div className="mt-2 p-2 bg-card rounded-sm border border-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 py-1 text-xs"
            >
              <div className="w-5 h-5 rounded-full bg-hover flex items-center justify-center text-[10px] text-foreground">
                {(member.userName?.[0] || '?').toUpperCase()}
              </div>
              <span className="text-foreground">{member.userName}</span>
              <span
                className={cn(
                  'text-[9px] px-1 py-0.5 rounded-sm',
                  member.role === 'owner' ? 'bg-primary text-white' : 'bg-hover text-muted-foreground'
                )}
              >
                {member.role === 'owner' ? '所有者' : '参与者'}
              </span>
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full ml-auto',
                  onlineUsers.some(u => u.userId === member.userId)
                    ? 'bg-status-running'
                    : 'bg-muted-foreground'
                )}
                title={onlineUsers.some(u => u.userId === member.userId) ? '在线' : '离线'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}