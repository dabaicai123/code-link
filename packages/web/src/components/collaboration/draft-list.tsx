'use client';

import { useState, useEffect } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import type { Draft } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';
import { formatShortDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';

interface DraftListProps {
  projectId?: number;
  onSelectDraft: (draft: Draft) => void;
  selectedDraftId?: number;
}

export function DraftList({ projectId, onSelectDraft, selectedDraftId }: DraftListProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    loadDrafts();
  }, [projectId]);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const result = await draftsApi.list(projectId);
      setDrafts(result.drafts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !projectId) return;

    try {
      const result = await draftsApi.create({
        projectId,
        title: newTitle.trim(),
      });
      setDrafts(prev => [result.draft, ...prev]);
      setNewTitle('');
      setShowCreate(false);
      onSelectDraft(result.draft);
    } catch (err) {
      console.error('Failed to create draft:', err);
    }
  };

  if (loading) {
    return <Loading className="p-4" />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        {error}
        <Button variant="secondary" size="sm" onClick={loadDrafts} className="mt-2">
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header justify-between">
        <span className="text-xs font-medium">
          Draft 列表 ({drafts.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs"
        >
          + 新建
        </Button>
      </div>

      {showCreate && (
        <div className="p-2 border-b border-border flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Draft 标题..."
            className="flex-1 px-2 py-1.5 text-xs border border-border rounded-sm bg-card text-foreground focus:border-primary outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
          />
          <Button variant="default" size="sm" onClick={handleCreate} className="text-xs">
            创建
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {drafts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">
            暂无 Draft，点击新建开始协作
          </div>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              onClick={() => onSelectDraft(draft)}
              className={cn(
                'p-3 rounded-md cursor-pointer border transition-colors mb-2 mx-2',
                selectedDraftId === draft.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-hover'
              )}
            >
              <div className="text-sm font-medium mb-1">{draft.title}</div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-sm text-white"
                  style={{ backgroundColor: DRAFT_STATUS_COLORS[draft.status] }}
                >
                  {DRAFT_STATUS_LABELS[draft.status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatShortDate(draft.updatedAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}