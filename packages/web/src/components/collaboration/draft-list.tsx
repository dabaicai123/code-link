'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Draft } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';
import { formatShortDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
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

  const loadDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getDrafts(projectId);
      setDrafts(result.drafts ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  if (loading) {
    return <Loading className="p-4" />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        {error}
        <button
          type="button"
          onClick={loadDrafts}
          className="mt-2 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-1.5 border-b border-border-default/50">
        <span className="text-[11px] font-medium text-text-muted">
          协作列表 ({drafts.length})
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {drafts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">
            暂无协作，点击新建开始
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