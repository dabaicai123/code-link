'use client';

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollaborationPanel } from '@/components/collaboration';
import { DisplayPanel } from '@/components/collaboration/display-panel';
import type { Project } from '@/types';

type RightTab = 'collab' | 'preview';

interface RightPanelProps {
  project: Project | null;
  userId: number;
}

export function RightPanel({ project, userId }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('collab');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleToggleCreate = useCallback(() => {
    setShowCreate((prev) => !prev);
    if (showCreate) setNewTitle('');
  }, [showCreate]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* ====== Tab header ====== */}
      <div className="h-[40px] border-b border-border-default px-4 flex items-center">
        <div className="flex items-center gap-0">
          <button
            onClick={() => setActiveTab('collab')}
            className={cn(
              'px-3 py-2 text-[13px] font-semibold transition-colors',
              activeTab === 'collab'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            协作
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              'px-3 py-2 text-[13px] font-semibold transition-colors',
              activeTab === 'preview'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            预览
          </button>
        </div>
      </div>

      {/* ====== Content ====== */}
      {activeTab === 'collab' ? (
        <>
          {/* 新建协作 row */}
          <div className="px-4 py-2 border-b border-border-default/50">
            <button
              onClick={handleToggleCreate}
              className="text-[13px] text-text-muted hover:text-accent-primary transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              新建协作
            </button>
          </div>

          {showCreate && (
            <div className="px-3 py-2 border-b border-border-default/50 flex items-center gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="协作标题..."
                className="flex-1 h-8 px-3 text-[13px] border border-border-default rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowCreate(false);
                    setNewTitle('');
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  // Placeholder — creation flow will be wired in Task 6
                  setShowCreate(false);
                  setNewTitle('');
                }}
                className="h-8 px-3 rounded-lg bg-accent-primary text-white text-[13px] font-medium hover:bg-accent-hover transition-colors"
              >
                创建
              </button>
            </div>
          )}

          <CollaborationPanel
            projectId={project?.id}
            currentUserId={userId}
          />
        </>
      ) : (
        <DisplayPanel url={undefined} />
      )}
    </div>
  );
}
