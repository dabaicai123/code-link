'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DraftList } from './draft-list';
import { CollaborationTimeline } from './collaboration-timeline';
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
  newlyCreatedDraft?: Draft | null;  // when set, auto-select this draft
}

export function CollaborationPanel({
  projectId,
  currentUserId,
  currentUserName,
  newlyCreatedDraft,
}: CollaborationPanelProps) {
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Auto-select newly created draft
  useEffect(() => {
    if (newlyCreatedDraft) {
      setSelectedDraft(newlyCreatedDraft);
    }
  }, [newlyCreatedDraft]);

  // WebSocket for online users
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

  // Load Draft details when a draft is selected
  useEffect(() => {
    if (selectedDraft) {
      loadDraftDetails(selectedDraft.id);
    }
  }, [selectedDraft?.id]);

  // Sync online users from WebSocket
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
  };

  const handleBackToList = () => {
    setSelectedDraft(null);
    setMembers([]);
    setOnlineUsers([]);
  };

  const handleStatusChange = (status: DraftStatus) => {
    if (selectedDraft) {
      setSelectedDraft({ ...selectedDraft, status });
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {selectedDraft ? (
        /* ====== Timeline view for selected draft ====== */
        <CollaborationTimeline
          draft={selectedDraft}
          members={members}
          onlineUsers={onlineUsers}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onBack={handleBackToList}
          onStatusChange={handleStatusChange}
        />
      ) : (
        /* ====== Draft list for selection ====== */
        <>
          {/* Header with title */}
          <div className="h-[44px] border-b border-border-default px-4 flex items-center gap-4">
            <span className="text-[13px] font-semibold text-accent-primary pb-2 border-b-2 border-accent-primary">
              草稿
            </span>
            <button className="ml-auto text-[13px] text-text-muted hover:text-accent-primary transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              新建
            </button>
          </div>

          <DraftList
            projectId={projectId}
            onSelectDraft={handleSelectDraft}
            selectedDraftId={undefined}
          />
        </>
      )}
    </div>
  );
}

// Export all sub-components
export { DraftList } from './draft-list';
export { MessagePanel } from './message-panel';
export { MessageItem } from './message-item';
export { MessageInput } from './message-input';
export { DraftHeader } from './draft-header';
export { OnlineUsers } from './online-users';
export { DisplayPanel } from './display-panel';
export { CollaborationTimeline } from './collaboration-timeline';