'use client';

import { useState, useEffect } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import { DraftList } from './draft-list';
import { MessagePanel } from './message-panel';
import { DraftHeader } from './draft-header';
import { DisplayPanel, SelectedElement } from './display-panel';
import { useDraftWebSocket } from '../../hooks/use-draft-websocket';
import type { Draft, DraftMember, DraftStatus } from '../../types/draft';
import type { DraftOnlineUser } from '@/lib/socket/types';
import { Button } from '@/components/ui/button';

type OnlineUser = DraftOnlineUser;

interface CollaborationPanelProps {
  projectId?: number;
  currentUserId?: number;
  currentUserName?: string;
  onAddElement?: (element: SelectedElement) => void;
}

type PanelType = 'display' | 'drafts';
type ViewMode = 'list' | 'draft';

export function CollaborationPanel({
  projectId,
  currentUserId,
  currentUserName,
  onAddElement,
}: CollaborationPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('display');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // WebSocket 用于在线用户
  const { onlineUsers: wsOnlineUsers } = useDraftWebSocket({
    draftId: selectedDraft?.id ?? null,
    userId: currentUserId || 0,
    userName: currentUserName || 'Unknown',
    onMemberJoined: (userId, userName) => {
      setOnlineUsers(prev => {
        if (prev.some(u => u.userId === userId)) return prev;
        return [...prev, { userId, userName }];
      });
    },
    onMemberLeft: (userId) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== userId));
    },
    onStatusChanged: (status) => {
      if (selectedDraft) {
        setSelectedDraft({ ...selectedDraft, status: status as DraftStatus });
      }
    },
  });

  // 加载 Draft 详情
  useEffect(() => {
    if (selectedDraft) {
      loadDraftDetails(selectedDraft.id);
    }
  }, [selectedDraft?.id]);

  // 同步在线用户
  useEffect(() => {
    setOnlineUsers(wsOnlineUsers);
  }, [wsOnlineUsers]);

  const loadDraftDetails = async (draftId: number) => {
    try {
      const result = await draftsApi.get(draftId);
      setMembers(result.members);
    } catch (err) {
      console.error('Failed to load draft details:', err);
    }
  };

  const handleSelectDraft = (draft: Draft) => {
    setSelectedDraft(draft);
    setViewMode('draft');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedDraft(null);
    setMembers([]);
    setOnlineUsers([]);
  };

  const handleStatusChange = (status: DraftStatus) => {
    if (selectedDraft) {
      setSelectedDraft({ ...selectedDraft, status });
    }
  };

  const handleDelete = () => {
    handleBackToList();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* 头部导航 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {viewMode === 'draft' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToList}
              style={{ fontSize: '11px' }}
            >
              ← 返回
            </Button>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {selectedDraft?.title}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              协作面板
            </span>
            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              <Button
                size="sm"
                onClick={() => setActivePanel('display')}
                style={{
                  fontSize: '11px',
                  backgroundColor: activePanel === 'display' ? 'var(--accent-primary)' : 'var(--bg-hover)',
                  color: activePanel === 'display' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                展示
              </Button>
              <Button
                size="sm"
                onClick={() => setActivePanel('drafts')}
                style={{
                  fontSize: '11px',
                  backgroundColor: activePanel === 'drafts' ? 'var(--accent-primary)' : 'var(--bg-hover)',
                  color: activePanel === 'drafts' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                Draft
              </Button>
            </div>
          </>
        )}
      </div>

      {/* 内容区域 */}
      {activePanel === 'display' && viewMode === 'list' ? (
        <DisplayPanel onAddElement={onAddElement || (() => {})} />
      ) : viewMode === 'list' ? (
        <DraftList
          projectId={projectId}
          onSelectDraft={handleSelectDraft}
          selectedDraftId={selectedDraft?.id}
        />
      ) : selectedDraft ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DraftHeader
            draft={selectedDraft}
            members={members}
            onlineUsers={onlineUsers}
            currentUserId={currentUserId}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
          <MessagePanel
            draft={selectedDraft}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </div>
      ) : null}
    </div>
  );
}

// 导出所有子组件
export { DraftList } from './draft-list';
export { MessagePanel } from './message-panel';
export { MessageItem } from './message-item';
export { MessageInput } from './message-input';
export { DraftHeader } from './draft-header';
export { OnlineUsers } from './online-users';
export { DisplayPanel } from './display-panel';