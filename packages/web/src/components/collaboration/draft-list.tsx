'use client';

import { useState, useEffect } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import type { Draft } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';
import { formatShortDate } from '@/lib/date-utils';

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
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--status-error)' }}>
        {error}
        <button onClick={loadDrafts} className="btn btn-secondary" style={{ marginTop: '8px' }}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          Draft 列表 ({drafts.length})
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          + 新建
        </button>
      </div>

      {showCreate && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Draft 标题..."
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
          />
          <button onClick={handleCreate} className="btn" style={{ padding: '6px 12px', fontSize: '11px' }}>
            创建
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {drafts.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
            暂无 Draft，点击新建开始协作
          </div>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              onClick={() => onSelectDraft(draft)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                backgroundColor: selectedDraftId === draft.id ? 'var(--bg-hover)' : 'transparent',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (selectedDraftId !== draft.id) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDraftId !== draft.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {draft.title}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {formatShortDate(draft.updatedAt)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: DRAFT_STATUS_COLORS[draft.status],
                    color: 'white',
                  }}
                >
                  {DRAFT_STATUS_LABELS[draft.status]}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}