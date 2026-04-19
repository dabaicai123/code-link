# 多人协作模块实现计划（Phase 3: 前端协作面板 UI）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现协作面板的前端 UI，包括 Draft 列表、消息面板、成员管理和实时更新。

**Architecture:** 基于 Phase 2 的 WebSocket 基础，创建协作面板组件；使用 React hooks 管理状态；复用现有组件风格。

**Tech Stack:** React 19, Next.js 16, TypeScript, 原生 WebSocket

---

## 文件结构

```
packages/web/
└── src/
    ├── components/
    │   └── collaboration/
    │       ├── index.tsx              # 修改：重构为 Draft 协作面板
    │       ├── draft-list.tsx         # 新增：Draft 列表组件
    │       ├── message-panel.tsx      # 新增：消息面板组件
    │       ├── message-item.tsx       # 新增：消息项组件
    │       ├── message-input.tsx      # 新增：消息输入组件
    │       ├── draft-header.tsx       # 新增：Draft 头部组件
    │       ├── online-users.tsx       # 已有：在线用户组件
    │       └── display-panel.tsx      # 已有：展示面板
    ├── lib/
    │   ├── draft-websocket.ts         # 已有：WebSocket Hook
    │   └── drafts-api.ts              # 新增：Draft API 客户端
    └── types/
        └── draft.ts                   # 新增：Draft 类型定义
```

---

## Task 1: 创建 Draft 类型定义

**Files:**
- Create: `packages/web/src/types/draft.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// packages/web/src/types/draft.ts

export type DraftStatus =
  | 'discussing'
  | 'brainstorming'
  | 'reviewing'
  | 'developing'
  | 'confirmed'
  | 'archived';

export type DraftMemberRole = 'owner' | 'participant';

export type MessageType =
  | 'text'
  | 'image'
  | 'code'
  | 'document_card'
  | 'ai_command'
  | 'system';

export type ConfirmationType = 'agree' | 'disagree' | 'suggest';

export interface Draft {
  id: number;
  project_id: number;
  title: string;
  status: DraftStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DraftMember {
  id: number;
  draft_id: number;
  user_id: number;
  role: DraftMemberRole;
  joined_at: string;
  user_name?: string;
  user_email?: string;
}

export interface DraftMessage {
  id: number;
  draft_id: number;
  parent_id: number | null;
  user_id: number;
  user_name?: string;
  content: string;
  message_type: MessageType;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageConfirmation {
  id: number;
  message_id: number;
  user_id: number;
  type: ConfirmationType;
  comment: string | null;
  created_at: string;
  user_name?: string;
}

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

export interface SendMessageInput {
  content: string;
  messageType?: MessageType;
  parentId?: number;
  metadata?: Record<string, unknown>;
}

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  discussing: '讨论中',
  brainstorming: '头脑风暴',
  reviewing: '评审中',
  developing: '开发中',
  confirmed: '已确认',
  archived: '已归档',
};

export const DRAFT_STATUS_COLORS: Record<DraftStatus, string> = {
  discussing: 'var(--status-info)',
  brainstorming: 'var(--accent-color)',
  reviewing: 'var(--status-warning)',
  developing: 'var(--status-success)',
  confirmed: '#22c55e',
  archived: 'var(--text-secondary)',
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/types/draft.ts
git commit -m "$(cat <<'EOF'
feat(web): add Draft type definitions

Add types for Draft, DraftMember, DraftMessage, MessageConfirmation
and status display constants.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 Draft API 客户端

**Files:**
- Create: `packages/web/src/lib/drafts-api.ts`

- [ ] **Step 1: 创建 API 客户端**

```typescript
// packages/web/src/lib/drafts-api.ts
import type {
  Draft,
  DraftMember,
  DraftMessage,
  CreateDraftInput,
  SendMessageInput,
  DraftStatus,
  ConfirmationType,
} from '../types/draft';

const API_BASE = '/api/drafts';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const draftsApi = {
  // 创建 Draft
  async create(input: CreateDraftInput): Promise<{ draft: Draft }> {
    return fetchApi(`${API_BASE}`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 获取 Draft 列表
  async list(projectId?: number): Promise<{ drafts: Draft[] }> {
    const url = projectId ? `${API_BASE}?projectId=${projectId}` : API_BASE;
    return fetchApi(url);
  },

  // 获取 Draft 详情
  async get(draftId: number): Promise<{ draft: Draft; members: DraftMember[] }> {
    return fetchApi(`${API_BASE}/${draftId}`);
  },

  // 更新 Draft 状态
  async updateStatus(draftId: number, status: DraftStatus): Promise<{ draft: Draft }> {
    return fetchApi(`${API_BASE}/${draftId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // 删除 Draft
  async delete(draftId: number): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}`, {
      method: 'DELETE',
    });
  },

  // 添加成员
  async addMember(draftId: number, userId: number): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // 移除成员
  async removeMember(draftId: number, userId: number): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  // 获取消息列表
  async getMessages(
    draftId: number,
    options?: { parentId?: number; limit?: number; before?: string }
  ): Promise<{ messages: DraftMessage[] }> {
    const params = new URLSearchParams();
    if (options?.parentId !== undefined) {
      params.set('parentId', String(options.parentId));
    }
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.before) {
      params.set('before', options.before);
    }
    const query = params.toString();
    return fetchApi(`${API_BASE}/${draftId}/messages${query ? `?${query}` : ''}`);
  },

  // 发送消息
  async sendMessage(draftId: number, input: SendMessageInput): Promise<{ message: DraftMessage }> {
    return fetchApi(`${API_BASE}/${draftId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 确认消息
  async confirmMessage(
    draftId: number,
    messageId: number,
    type: ConfirmationType,
    comment?: string
  ): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}/messages/${messageId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ type, comment }),
    });
  },

  // 获取消息确认列表
  async getConfirmations(
    draftId: number,
    messageId: number
  ): Promise<{ confirmations: Array<{ user_id: number; user_name: string; type: string; comment: string | null }> }> {
    return fetchApi(`${API_BASE}/${draftId}/messages/${messageId}/confirmations`);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/drafts-api.ts
git commit -m "$(cat <<'EOF'
feat(web): add Draft API client

Add API client with CRUD operations for drafts, messages,
and member management.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 创建 Draft 列表组件

**Files:**
- Create: `packages/web/src/components/collaboration/draft-list.tsx`

- [ ] **Step 1: 创建 Draft 列表组件**

```typescript
// packages/web/src/components/collaboration/draft-list.tsx
'use client';

import { useState, useEffect } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import type { Draft, DraftStatus } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
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
                  {formatDate(draft.updated_at)}
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/draft-list.tsx
git commit -m "$(cat <<'EOF'
feat(web): add DraftList component

Add component to display draft list with status indicators,
create dialog, and selection handling.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 创建消息项组件

**Files:**
- Create: `packages/web/src/components/collaboration/message-item.tsx`

- [ ] **Step 1: 创建消息项组件**

```typescript
// packages/web/src/components/collaboration/message-item.tsx
'use client';

import { useState } from 'react';
import type { DraftMessage, MessageConfirmation } from '../../types/draft';
import { draftsApi } from '../../lib/drafts-api';

interface MessageItemProps {
  message: DraftMessage;
  currentUserId?: number;
  onReply?: (message: DraftMessage) => void;
  onConfirm?: (messageId: number, type: string) => void;
}

export function MessageItem({ message, currentUserId, onReply, onConfirm }: MessageItemProps) {
  const [showConfirmations, setShowConfirmations] = useState(false);
  const [confirmations, setConfirmations] = useState<MessageConfirmation[]>([]);
  const [userConfirm, setUserConfirm] = useState<string | null>(null);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleConfirm = async (type: 'agree' | 'disagree' | 'suggest') => {
    try {
      await draftsApi.confirmMessage(message.draft_id, message.id, type);
      setUserConfirm(type);
      onConfirm?.(message.id, type);
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
  };

  const loadConfirmations = async () => {
    try {
      const result = await draftsApi.getConfirmations(message.draft_id, message.id);
      setConfirmations(result.confirmations as MessageConfirmation[]);
      const userConf = result.confirmations.find((c) => c.user_id === currentUserId);
      if (userConf) {
        setUserConfirm(userConf.type);
      }
    } catch (err) {
      console.error('Failed to load confirmations:', err);
    }
  };

  const handleShowConfirmations = () => {
    if (!showConfirmations) {
      loadConfirmations();
    }
    setShowConfirmations(!showConfirmations);
  };

  const isCode = message.message_type === 'code';
  const isAICommand = message.message_type === 'ai_command';
  const isSystem = message.message_type === 'system';

  if (isSystem) {
    return (
      <div style={{ padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius-md)' }}>
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* 头像 */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: isAICommand ? 'var(--accent-color)' : 'var(--bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: isAICommand ? 'white' : 'var(--text-primary)',
            flexShrink: 0,
          }}
        >
          {isAICommand ? 'AI' : (message.user_name?.[0] || '?').toUpperCase()}
        </div>

        {/* 消息内容 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {isAICommand ? 'AI 助手' : message.user_name || '未知用户'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {formatTime(message.created_at)}
            </span>
          </div>

          {/* 消息文本/代码 */}
          {isCode ? (
            <pre
              style={{
                margin: 0,
                padding: '8px 10px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontFamily: 'monospace',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {message.content}
            </pre>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {message.content}
            </div>
          )}

          {/* AI 指令标签 */}
          {isAICommand && (
            <div style={{ marginTop: '4px' }}>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(124, 58, 237, 0.15)',
                  color: 'var(--accent-light)',
                  border: '1px solid var(--accent-color)',
                }}
              >
                @AI 指令
              </span>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            {/* 确认按钮 */}
            <button
              onClick={() => handleConfirm('agree')}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: userConfirm === 'agree' ? 'var(--status-success)' : 'var(--bg-hover)',
                color: userConfirm === 'agree' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="赞同"
            >
              ✓ 赞同
            </button>
            <button
              onClick={() => handleConfirm('disagree')}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: userConfirm === 'disagree' ? 'var(--status-error)' : 'var(--bg-hover)',
                color: userConfirm === 'disagree' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="反对"
            >
              ✗ 反对
            </button>
            <button
              onClick={() => handleConfirm('suggest')}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: userConfirm === 'suggest' ? 'var(--status-warning)' : 'var(--bg-hover)',
                color: userConfirm === 'suggest' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="建议"
            >
              💡 建议
            </button>

            {/* 回复按钮 */}
            <button
              onClick={() => onReply?.(message)}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              回复
            </button>

            {/* 查看确认 */}
            <button
              onClick={handleShowConfirmations}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {showConfirmations ? '隐藏' : '详情'}
            </button>
          </div>

          {/* 确认详情 */}
          {showConfirmations && confirmations.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              {confirmations.map((conf) => (
                <div key={conf.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{conf.user_name}</span>
                  <span
                    style={{
                      padding: '1px 4px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor:
                        conf.type === 'agree' ? 'var(--status-success)' :
                        conf.type === 'disagree' ? 'var(--status-error)' : 'var(--status-warning)',
                      color: 'white',
                      fontSize: '9px',
                    }}
                  >
                    {conf.type === 'agree' ? '赞同' : conf.type === 'disagree' ? '反对' : '建议'}
                  </span>
                  {conf.comment && (
                    <span style={{ color: 'var(--text-secondary)' }}>: {conf.comment}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/message-item.tsx
git commit -m "$(cat <<'EOF'
feat(web): add MessageItem component

Add message display with user avatar, confirmations,
code formatting, and AI command labels.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 创建消息输入组件

**Files:**
- Create: `packages/web/src/components/collaboration/message-input.tsx`

- [ ] **Step 1: 创建消息输入组件**

```typescript
// packages/web/src/components/collaboration/message-input.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import type { DraftMessage, MessageType } from '../../types/draft';

interface MessageInputProps {
  draftId: number;
  replyTo?: DraftMessage | null;
  onSend: (content: string, messageType: MessageType, parentId?: number) => Promise<void>;
  onCancelReply?: () => void;
}

export function MessageInput({ draftId, replyTo, onSend, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>('text');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      await onSend(content.trim(), messageType, replyTo?.id);
      setContent('');
      setMessageType('text');
      onCancelReply?.();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleCodeMode = () => {
    setMessageType(prev => prev === 'code' ? 'text' : 'code');
  };

  const insertAICommand = () => {
    setContent(prev => prev + '@AI ');
    setMessageType('ai_command');
    textareaRef.current?.focus();
  };

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* 回复提示 */}
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '6px 8px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            回复 {replyTo.user_name}:
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? '...' : ''}
          </span>
          <button
            onClick={onCancelReply}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messageType === 'code' ? '输入代码...' : messageType === 'ai_command' ? '输入 AI 指令...' : '输入消息...'}
            style={{
              width: '100%',
              minHeight: '60px',
              maxHeight: '150px',
              padding: '8px 10px',
              fontSize: '13px',
              fontFamily: messageType === 'code' ? 'monospace' : 'inherit',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
            }}
          />

          {/* 类型指示器 */}
          {messageType !== 'text' && (
            <div style={{ position: 'absolute', top: '4px', right: '8px' }}>
              <span
                style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: messageType === 'ai_command' ? 'var(--accent-color)' : 'var(--bg-hover)',
                  color: messageType === 'ai_command' ? 'white' : 'var(--text-secondary)',
                }}
              >
                {messageType === 'ai_command' ? 'AI 指令' : '代码'}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="btn"
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              opacity: !content.trim() || sending ? 0.5 : 1,
            }}
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button
          onClick={toggleCodeMode}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: messageType === 'code' ? 'var(--accent-color)' : 'var(--bg-hover)',
            color: messageType === 'code' ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {'</>'}
        </button>
        <button
          onClick={insertAICommand}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: messageType === 'ai_command' ? 'var(--accent-color)' : 'var(--bg-hover)',
            color: messageType === 'ai_command' ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          @AI
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/message-input.tsx
git commit -m "$(cat <<'EOF'
feat(web): add MessageInput component

Add message input with reply support, code mode,
and AI command shortcut.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 创建消息面板组件

**Files:**
- Create: `packages/web/src/components/collaboration/message-panel.tsx`

- [ ] **Step 1: 创建消息面板组件**

```typescript
// packages/web/src/components/collaboration/message-panel.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import { useDraftWebSocket } from '../../lib/draft-websocket';
import { MessageItem } from './message-item';
import { MessageInput } from './message-input';
import type { Draft, DraftMessage, MessageType } from '../../types/draft';

interface MessagePanelProps {
  draft: Draft;
  currentUserId?: number;
  currentUserName?: string;
}

export function MessagePanel({ draft, currentUserId, currentUserName }: MessagePanelProps) {
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<DraftMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // WebSocket 回调
  const handleMessageReceived = useCallback((message: DraftMessage) => {
    setMessages(prev => {
      // 避免重复添加
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
    setTimeout(scrollToBottom, 50);
  }, []);

  const { isConnected, onlineUsers } = useDraftWebSocket({
    draftId: draft.id,
    userId: currentUserId || 0,
    userName: currentUserName || 'Unknown',
    onMessageReceived: handleMessageReceived,
  });

  // 加载历史消息
  useEffect(() => {
    loadMessages();
  }, [draft.id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await draftsApi.getMessages(draft.id, { limit: 100 });
      setMessages(result.messages);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (content: string, messageType: MessageType, parentId?: number) => {
    const result = await draftsApi.sendMessage(draft.id, {
      content,
      messageType,
      parentId,
    });
    // WebSocket 会广播消息，这里不需要手动添加
  };

  const handleConfirm = (messageId: number, type: string) => {
    // 更新本地状态
  };

  // 按层级组织消息（简化版，不支持深层嵌套）
  const rootMessages = messages.filter(m => m.parent_id === null);
  const getReplies = (parentId: number) => messages.filter(m => m.parent_id === parentId);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 连接状态 */}
      <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isConnected ? 'var(--status-success)' : 'var(--status-error)',
          }}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          {isConnected ? '已连接' : '断开连接'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {onlineUsers.length} 人在线
        </span>
      </div>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rootMessages.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
            暂无消息，发送第一条消息开始讨论
          </div>
        ) : (
          rootMessages.map((message) => (
            <div key={message.id}>
              <MessageItem
                message={message}
                currentUserId={currentUserId}
                onReply={setReplyTo}
                onConfirm={handleConfirm}
              />
              {/* 显示回复 */}
              {getReplies(message.id).map((reply) => (
                <div key={reply.id} style={{ paddingLeft: '36px' }}>
                  <MessageItem
                    message={reply}
                    currentUserId={currentUserId}
                    onReply={setReplyTo}
                    onConfirm={handleConfirm}
                  />
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <MessageInput
        draftId={draft.id}
        replyTo={replyTo}
        onSend={handleSend}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/message-panel.tsx
git commit -m "$(cat <<'EOF'
feat(web): add MessagePanel component

Add message list with WebSocket real-time updates,
thread support, and connection status display.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 创建 Draft 头部组件

**Files:**
- Create: `packages/web/src/components/collaboration/draft-header.tsx`

- [ ] **Step 1: 创建 Draft 头部组件**

```typescript
// packages/web/src/components/collaboration/draft-header.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/draft-header.tsx
git commit -m "$(cat <<'EOF'
feat(web): add DraftHeader component

Add header with status selector, online users,
and member list display.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 重构协作面板主组件

**Files:**
- Modify: `packages/web/src/components/collaboration/index.tsx`

- [ ] **Step 1: 重构协作面板组件**

```typescript
// packages/web/src/components/collaboration/index.tsx
'use client';

import { useState, useEffect } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import { DraftList } from './draft-list';
import { MessagePanel } from './message-panel';
import { DraftHeader } from './draft-header';
import { useDraftWebSocket } from '../../lib/draft-websocket';
import type { Draft, DraftMember, DraftStatus } from '../../types/draft';
import type { OnlineUser } from '../../lib/draft-websocket';

interface CollaborationPanelProps {
  projectId: number;
  currentUserId?: number;
  currentUserName?: string;
}

type ViewMode = 'list' | 'draft';

export function CollaborationPanel({
  projectId,
  currentUserId,
  currentUserName,
}: CollaborationPanelProps) {
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
        {viewMode === 'draft' && (
          <button
            onClick={handleBackToList}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            ← 返回
          </button>
        )}
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {viewMode === 'list' ? '协作面板' : selectedDraft?.title}
        </span>
      </div>

      {/* 内容区域 */}
      {viewMode === 'list' ? (
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/collaboration/index.tsx
git commit -m "$(cat <<'EOF'
feat(web): refactor CollaborationPanel with Draft support

Refactor panel to show Draft list and message view,
with navigation and real-time updates.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成检查

- [ ] 所有组件正常渲染
- [ ] Draft 列表可正常加载和创建
- [ ] 消息可正常发送和接收
- [ ] WebSocket 实时更新正常
- [ ] 在线用户显示正确
- [ ] 代码已提交

---

**Phase 3 完成。后续 Phase 将包括：**
- Phase 4: @AI 指令集成
- Phase 5: Yjs/Hocuspocus 实时同步
