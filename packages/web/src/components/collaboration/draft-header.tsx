'use client';

import { useState } from 'react';
import type { Draft, DraftStatus, DraftMember } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';
import { draftsApi } from '../../lib/drafts-api';
import { OnlineUsers } from './online-users';
import type { OnlineUser } from '../../lib/draft-websocket';

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

  const isOwner = members.find(m => m.user_id === currentUserId)?.role === 'owner';

  return (
    <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* 标题和状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {draft.title}
        </h3>

        {/* 状态选择器 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            disabled={updating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: DRAFT_STATUS_COLORS[draft.status],
              color: 'white',
              cursor: 'pointer',
              opacity: updating ? 0.7 : 1,
            }}
          >
            {DRAFT_STATUS_LABELS[draft.status]}
            <span style={{ fontSize: '8px' }}>▼</span>
          </button>

          {showStatusMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 10,
                minWidth: '120px',
              }}
            >
              {(Object.keys(DRAFT_STATUS_LABELS) as DraftStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: DRAFT_STATUS_COLORS[status],
                      marginRight: '8px',
                    }}
                  />
                  {DRAFT_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 更多操作 */}
        {isOwner && (
          <button
            onClick={handleDelete}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              border: '1px solid var(--status-error)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              color: 'var(--status-error)',
              cursor: 'pointer',
            }}
          >
            删除
          </button>
        )}
      </div>

      {/* 在线用户 */}
      <div style={{ marginBottom: '8px' }}>
        <OnlineUsers users={onlineUsers} currentUserId={currentUserId} />
      </div>

      {/* 成员信息 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => setShowMemberMenu(!showMemberMenu)}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          👥 {members.length} 成员
        </button>
      </div>

      {/* 成员列表弹出 */}
      {showMemberMenu && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
          }}
        >
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 0',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'var(--text-primary)',
                }}
              >
                {(member.user_name?.[0] || '?').toUpperCase()}
              </div>
              <span style={{ color: 'var(--text-primary)' }}>{member.user_name}</span>
              <span
                style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: member.role === 'owner' ? 'var(--accent-color)' : 'var(--bg-hover)',
                  color: member.role === 'owner' ? 'white' : 'var(--text-secondary)',
                }}
              >
                {member.role === 'owner' ? '所有者' : '参与者'}
              </span>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: onlineUsers.some(u => u.userId === member.user_id)
                    ? 'var(--status-success)'
                    : 'var(--text-secondary)',
                  marginLeft: 'auto',
                }}
                title={onlineUsers.some(u => u.userId === member.user_id) ? '在线' : '离线'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}