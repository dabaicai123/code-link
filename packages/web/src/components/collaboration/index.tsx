'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DraftList } from './draft-list';
import { MessagePanel } from './message-panel';
import { DraftHeader } from './draft-header';
import { DisplayPanel } from './display-panel';
import { useDraftSocket } from '@/lib/socket/draft';
import type { Draft, DraftMember, DraftStatus } from '../../types/draft';
import type { DraftOnlineUser } from '@/lib/socket/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type OnlineUser = DraftOnlineUser;

interface CollaborationPanelProps {
  projectId?: number;
  currentUserId?: number;
  currentUserName?: string;
}

type PanelType = 'display' | 'drafts';
type ViewMode = 'list' | 'draft';

export function CollaborationPanel({
  projectId,
  currentUserId,
  currentUserName,
}: CollaborationPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('display');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // WebSocket 用于在线用户
  const { onlineUsers: wsOnlineUsers } = useDraftSocket({
    draftId: selectedDraft?.id ?? null,
    onMemberJoined: (user) => {
      setOnlineUsers(prev => {
        if (prev.some(u => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    },
    onMemberLeft: (user) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== user.userId));
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
      const result = await api.getDraft(draftId);
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
    <div className="h-full flex flex-col bg-bg-primary">
      {/* 头部导航 */}
      <div className="h-[44px] border-b border-border-default px-4 flex items-center gap-4">
        {viewMode === 'draft' ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              ← 返回
            </Button>
            <span className="text-sm font-medium text-text-primary">
              {selectedDraft?.title}
            </span>
          </>
        ) : (
          <>
            <button
              onClick={() => setActivePanel('display')}
              className={activePanel === 'display'
                ? 'text-[13px] font-semibold text-accent-primary pb-2 border-b-2 border-accent-primary'
                : 'text-[13px] text-text-muted hover:text-text-secondary transition-colors pb-2'
              }
            >
              展示
            </button>
            <button
              onClick={() => setActivePanel('drafts')}
              className={activePanel === 'drafts'
                ? 'text-[13px] font-semibold text-accent-primary pb-2 border-b-2 border-accent-primary'
                : 'text-[13px] text-text-muted hover:text-text-secondary transition-colors pb-2'
              }
            >
              草稿
            </button>
            <button className="ml-auto text-[13px] text-text-muted hover:text-accent-primary transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              新建
            </button>
          </>
        )}
      </div>

      {/* 内容区域 */}
      {activePanel === 'display' && viewMode === 'list' ? (
        <DisplayPanel />
      ) : viewMode === 'list' ? (
        <DraftList
          projectId={projectId}
          onSelectDraft={handleSelectDraft}
          selectedDraftId={selectedDraft?.id}
        />
      ) : selectedDraft ? (
        <div className="flex-1 flex flex-col overflow-hidden">
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