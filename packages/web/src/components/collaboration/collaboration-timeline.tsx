'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useDraftSocket } from '@/lib/socket/draft';
import { MessageInput } from './message-input';
import { CardDetailModal } from './card/card-detail-modal';
import { useCardContextMenu } from '@/hooks/use-card-context-menu';
import { cn } from '@/lib/utils';
import { Loading } from '@/components/ui/loading';
import { ArrowLeft, History, UserPlus } from 'lucide-react';
import type { Draft, DraftMessage, DraftStatus, DraftMember, MessageType } from '../../types/draft';
import { DRAFT_STATUS_LABELS, DRAFT_STATUS_COLORS } from '../../types/draft';
import type { Card, CardType, CardStatus } from '../../types/card';
import { CARD_TYPE_LABELS, CARD_TYPE_COLORS, STATUS_LABELS, STATUS_COLORS } from '../../types/card';
import type { DraftOnlineUser } from '@/lib/socket/types';

type OnlineUser = DraftOnlineUser;

// ==================== Timeline item union type ====================

type TimelineItemType = 'card' | 'message' | 'node';

interface TimelineNode {
  type: 'node';
  id: string;
  label: string;
  time: string;
  color: string;
  bgColor: string;
  borderColor: string;
  reference?: string;
  pulse?: boolean;
}

interface TimelineCard {
  type: 'card';
  id: string;
  card: Card;
  time: string;
}

interface TimelineMessage {
  type: 'message';
  id: string;
  message: DraftMessage;
  time: string;
}

type TimelineItem = TimelineNode | TimelineCard | TimelineMessage;

// ==================== Card type icon backgrounds ====================

const CARD_TYPE_BG: Record<CardType, string> = {
  brainstorming: 'bg-accent-light',
  writing_plans: 'bg-[rgba(232,190,92,0.15)]',
  development: 'bg-[rgba(93,138,84,0.12)]',
  free_chat: 'bg-accent-light',
  test: 'bg-[rgba(232,190,92,0.15)]',
  archive: 'bg-bg-secondary',
};

// Card type left-border accent colors (for summary section)
const CARD_TYPE_BORDER_L: Record<CardType, string> = {
  brainstorming: 'border-l-brainstorming/40',
  writing_plans: 'border-l-[rgba(232,190,92,0.4)]',
  development: 'border-l-[rgba(93,138,84,0.4)]',
  free_chat: 'border-l-accent-light/40',
  test: 'border-l-[rgba(232,190,92,0.4)]',
  archive: 'border-l-text-muted/40',
};

// Card type border colors for running accent stripe
const CARD_TYPE_BORDER_TOP: Record<CardType, string> = {
  brainstorming: 'border-brainstorming/20',
  writing_plans: 'border-[rgba(232,190,92,0.2)]',
  development: 'border-status-running/20',
  free_chat: 'border-accent-light/20',
  test: 'border-[rgba(232,190,92,0.2)]',
  archive: 'border-border-default',
};

// Status descriptions for timeline nodes
const CARD_TYPE_NODE_LABELS: Record<CardType, string> = {
  brainstorming: '头脑风暴',
  writing_plans: '制定计划',
  development: '开始开发',
  free_chat: '自由对话',
  test: '测试',
  archive: '归档',
};

// ==================== Timeline Node Component ====================

function TimelineNodeItem({ node }: { node: TimelineNode }) {
  return (
    <div data-testid={`timeline-node-${node.id}`} className="flex items-center gap-3 text-[12px] text-text-muted">
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 relative z-10',
          node.borderColor === 'border-accent-primary'
            ? 'bg-accent-light border-2 border-accent-primary'
            : node.borderColor === 'border-[rgba(232,190,92,0.2)]' || node.borderColor === 'border-plans'
              ? 'bg-[rgba(232,190,92,0.2)] border-2 border-plans'
              : node.borderColor === 'border-status-running'
                ? 'bg-[rgba(93,138,84,0.15)] border-2 border-status-running'
                : 'bg-bg-secondary border-2 border-border-default'
        )}
      >
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          node.pulse ? 'bg-status-running pulse-dot' : ''
        )}
          style={{ backgroundColor: node.color }}
        />
      </div>
      <span>{node.time} · {node.label}</span>
      {node.reference && (
        <span className="px-1.5 py-0.5 rounded text-[10px] text-accent-primary bg-accent-light">
          {node.reference}
        </span>
      )}
    </div>
  );
}

// ==================== Timeline Card Component ====================

interface TimelineCardItemProps {
  item: TimelineCard;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function TimelineCardItem({ item, onClick, onContextMenu }: TimelineCardItemProps) {
  const { card } = item;
  const isRunning = card.cardStatus === 'running';
  const isCompleted = card.cardStatus === 'completed';
  const typeColor = CARD_TYPE_COLORS[card.cardType];
  const typeLabel = CARD_TYPE_LABELS[card.cardType];
  const statusLabel = STATUS_LABELS[card.cardStatus];
  const statusColor = STATUS_COLORS[card.cardStatus];

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      data-testid={`timeline-card-${card.shortId}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        'pl-10 card-item bg-bg-card border rounded-xl p-4 shadow-warm-sm cursor-pointer relative',
        isRunning ? 'border-status-running/20' : 'border-border-default',
        CARD_TYPE_BORDER_TOP[card.cardType]
      )}
    >
      {/* Running accent stripe */}
      {isRunning && (
        <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-status-running/60 to-status-running/20">
          <div className="h-full bg-status-running rounded-t-xl animate-pulse" style={{ width: '40%' }} />
        </div>
      )}

      {/* Card header */}
      <div className="flex items-start gap-2.5 mb-3">
        {/* Type icon */}
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', CARD_TYPE_BG[card.cardType])}>
          <CardTypeIcon cardType={card.cardType} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-[14px] font-semibold">{card.title || `卡片 ${card.shortId}`}</span>
            {/* Type badge */}
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              card.cardType === 'brainstorming' ? 'text-brainstorming bg-accent-light' :
              card.cardType === 'writing_plans' ? 'text-plans bg-[rgba(232,190,92,0.15)]' :
              card.cardType === 'development' ? 'text-status-running bg-[rgba(93,138,84,0.1)]' :
              'text-text-muted bg-bg-secondary'
            )}>
              {typeLabel}
            </span>
            {/* Status badge */}
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              isRunning
                ? 'text-status-running bg-[rgba(93,138,84,0.1)] flex items-center gap-1'
                : isCompleted
                  ? 'text-status-running bg-[rgba(93,138,84,0.1)]'
                  : 'text-text-muted bg-bg-secondary'
            )}
              style={!isRunning && !isCompleted ? { color: statusColor } : undefined}
            >
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-status-running pulse-dot" />}
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[12px] text-text-muted">
            <span>{card.createdByName} · #{card.shortId}</span>
            <span>{formatTime(card.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Summary with left-border accent */}
      <div className={cn(
        'px-3 py-2 bg-bg-secondary rounded-lg text-[13px] text-text-secondary border-l-[3px]',
        CARD_TYPE_BORDER_L[card.cardType]
      )}>
        {card.summary || '暂无摘要'}
      </div>

      {/* Parent card reference */}
      {card.parentCardId && (
        <div className="text-[12px] text-accent-primary mt-2">
          ↑ 引用自 @{card.shortId}
        </div>
      )}

      {/* Progress bar for running cards */}
      {isRunning && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-[4px] bg-bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-status-running rounded-full animate-pulse" style={{ width: '40%' }} />
          </div>
          <span className="text-text-muted text-[11px]">执行中</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-2">
        {isCompleted && card.cardType === 'brainstorming' && (
          <button className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-[12px] font-medium hover:bg-accent-hover transition-colors flex items-center gap-1.5">
            执行计划 →
          </button>
        )}
        {isCompleted && card.cardType === 'writing_plans' && (
          <button className="px-3 py-1.5 rounded-lg bg-status-running text-white text-[12px] font-medium hover:bg-status-running/90 transition-colors flex items-center gap-1.5">
            开始编码 →
          </button>
        )}
        {isRunning && (
          <button className="px-3 py-1.5 rounded-lg border border-status-warning text-[12px] text-status-warning hover:bg-[rgba(232,190,92,0.1)] transition-colors flex items-center gap-1.5">
            暂停
          </button>
        )}
        <button data-testid="card-expand-detail" className="px-3 py-1.5 rounded-lg border border-border-default text-[12px] text-text-secondary hover:bg-bg-hover transition-colors">
          展开详情
        </button>
      </div>
    </div>
  );
}

// ==================== Card type icon ====================

function CardTypeIcon({ cardType }: { cardType: CardType }) {
  const colorClass =
    cardType === 'brainstorming' ? 'text-brainstorming' :
    cardType === 'writing_plans' ? 'text-plans' :
    cardType === 'development' ? 'text-status-running' :
    'text-text-muted';

  switch (cardType) {
    case 'brainstorming':
      return (
        <svg className={cn('w-4 h-4', colorClass)} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case 'writing_plans':
      return (
        <svg className={cn('w-4 h-4', colorClass)} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="16" y1="13" y2="13" />
          <line x1="8" x2="16" y1="13" y2="13" />
        </svg>
      );
    case 'development':
      return (
        <svg className={cn('w-4 h-4', colorClass)} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" x2="20" y1="19" y2="19" />
        </svg>
      );
    default:
      return (
        <svg className={cn('w-4 h-4', colorClass)} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

// ==================== Timeline Message Component ====================

function TimelineMessageItem({ item }: { item: TimelineMessage }) {
  const { message } = item;
  const isSystem = message.messageType === 'system';

  if (isSystem) {
    return (
      <div className="pl-10 py-2 px-3 text-center">
        <span className="text-[11px] text-text-muted bg-bg-secondary px-3 py-1 rounded-md">
          {message.content}
        </span>
      </div>
    );
  }

  const isAI = message.messageType === 'ai_command' || message.messageType === 'ai_response';
  const avatarLetter = isAI ? 'AI' : (message.userName?.[0] || '?').toUpperCase();
  const avatarBg = isAI ? 'bg-accent-primary text-white' : 'bg-accent-light text-accent-primary';
  const displayName = isAI ? 'AI 助手' : (message.userName || '未知用户');

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="pl-10 flex items-start gap-2.5">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
        isAI ? 'bg-accent-primary text-white text-[10px] font-semibold' : 'bg-accent-light text-accent-primary text-[11px] font-bold'
      )}>
        {avatarLetter}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-text-primary text-[13px] font-medium">{displayName}</span>
          <span className="text-text-muted text-[11px]">{formatTime(message.createdAt)}</span>
        </div>
        <div className="bg-bg-secondary border border-border-default rounded-lg rounded-tl-none px-4 py-3">
          <p className="text-text-secondary text-[14px] leading-relaxed">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== CSS for pulse animation ====================

// pulse-dot class is defined in global styles from collab-variant-1.html reference:
// .pulse-dot { animation: pulse 2s ease-in-out infinite; }
// @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
// We reference it here but need to make sure it exists in the global CSS.
// It's already added in the design-token CSS as part of the project's styling.

// ==================== Main CollaborationTimeline Component ====================

interface CollaborationTimelineProps {
  draft: Draft;
  members: DraftMember[];
  onlineUsers: OnlineUser[];
  currentUserId?: number;
  currentUserName?: string;
  onBack: () => void;
  onStatusChange: (status: DraftStatus) => void;
}

export function CollaborationTimeline({
  draft,
  members,
  onlineUsers,
  currentUserId,
  currentUserName,
  onBack,
  onStatusChange,
}: CollaborationTimelineProps) {
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<DraftMessage | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const { contextMenu, handleContextMenu, closeContextMenu } = useCardContextMenu();
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // WebSocket for real-time messages
  const handleMessageReceived = useCallback((msg: { draftId: number; message: { id: number; draft_id: number; parent_id: number | null; user_id: number; user_name: string; content: string; message_type: string; created_at: string }; timestamp: string }) => {
    const draftMessage: DraftMessage = {
      id: msg.message.id,
      draftId: msg.message.draft_id,
      parentId: msg.message.parent_id,
      userId: msg.message.user_id,
      userName: msg.message.user_name,
      content: msg.message.content,
      messageType: msg.message.message_type as MessageType,
      metadata: null,
      createdAt: msg.message.created_at,
      updatedAt: msg.message.created_at,
    };
    setMessages(prev => {
      if (prev.some(m => m.id === draftMessage.id)) return prev;
      return [...prev, draftMessage];
    });
    setTimeout(scrollToBottom, 50);
  }, []);

  const { isConnected, onlineUsers: wsOnlineUsers } = useDraftSocket({
    draftId: draft.id,
    onMessage: handleMessageReceived,
  });

  // Merge WebSocket online users
  const mergedOnlineUsers = wsOnlineUsers.length > 0 ? wsOnlineUsers : onlineUsers;

  // Load messages and cards
  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const [msgResult, cardResult] = await Promise.all([
        api.getDraftMessages(draft.id, { limit: 200 }),
        api.getDraftCards(draft.id),
      ]);
      setMessages(msgResult.messages);
      setCards(cardResult.cards);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [draft.id]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Build timeline items: merge cards and messages by createdAt, inserting timeline nodes for cards
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Create nodes for each card (before the card itself)
    for (const card of cards) {
      const nodeColor = CARD_TYPE_COLORS[card.cardType];
      const nodeLabel = CARD_TYPE_NODE_LABELS[card.cardType];

      // Determine node background/border based on card type
      let borderColor: string;
      if (card.cardType === 'brainstorming') {
        borderColor = 'border-accent-primary';
      } else if (card.cardType === 'writing_plans') {
        borderColor = 'border-[rgba(232,190,92,0.2)]';
      } else if (card.cardType === 'development') {
        borderColor = 'border-status-running';
      } else {
        borderColor = 'border-border-default';
      }

      const reference = card.parentCardId ? `↑ 引用自 @${cards.find(c => c.id === card.parentCardId)?.shortId || card.parentCardId.slice(0, 8)}` : undefined;

      const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      items.push({
        type: 'node',
        id: `node-${card.id}`,
        label: nodeLabel,
        time: formatTime(card.createdAt),
        color: nodeColor,
        bgColor: card.cardType === 'brainstorming' ? 'bg-accent-light' :
                  card.cardType === 'writing_plans' ? 'bg-[rgba(232,190,92,0.2)]' :
                  card.cardType === 'development' ? 'bg-[rgba(93,138,84,0.15)]' :
                  'bg-bg-secondary',
        borderColor,
        reference,
        pulse: card.cardStatus === 'running',
      });

      items.push({
        type: 'card',
        id: card.id,
        card,
        time: card.createdAt,
      });
    }

    // Add messages
    const rootMessages = messages.filter(m => m.parentId === null);
    for (const message of rootMessages) {
      items.push({
        type: 'message',
        id: `msg-${message.id}`,
        message,
        time: message.createdAt,
      });
    }

    // Sort all items by time
    items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return items;
  }, [cards, messages]);

  // Send message handler
  const handleSend = async (content: string, messageType: MessageType, parentId?: number) => {
    await api.sendDraftMessage(draft.id, {
      content,
      messageType,
      parentId,
    });
  };

  // Draft ID display format
  const draftShortId = `#D-${String(draft.id).padStart(4, '0')}`;

  // Online users display
  const displayOnlineUsers = mergedOnlineUsers.slice(0, 3);
  const remainingCount = mergedOnlineUsers.length - 3;

  if (loading) {
    return <Loading className="h-full" />;
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* ====== Top Header Bar ====== */}
      <div className="h-[48px] border-b border-border-default bg-bg-card flex items-center px-5 justify-between">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={onBack}
            className="text-[13px] text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回
          </button>

          <div className="w-px h-6 bg-border-default" />

          {/* Draft title + ID */}
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-[14px] font-semibold">{draft.title}</span>
            <span className="px-2 py-0.5 rounded-md bg-bg-secondary text-text-muted text-[11px] font-mono">
              {draftShortId}
            </span>
          </div>

          {/* Draft status badge */}
          <span className={cn(
            'flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border',
            draft.status === 'developing'
              ? 'bg-[rgba(93,138,84,0.1)] border-[rgba(93,138,84,0.2)]'
              : draft.status === 'brainstorming'
                ? 'bg-accent-light border-accent-primary/20'
                : 'bg-bg-secondary border-border-default'
          )}
            style={draft.status !== 'developing' && draft.status !== 'brainstorming' ? { backgroundColor: undefined } : undefined}
          >
            <span className={cn(
              'w-1.5 h-1.5 rounded-full pulse-dot',
              draft.status === 'developing' ? 'bg-status-running' :
              draft.status === 'brainstorming' ? 'bg-accent-primary' :
              'bg-text-muted'
            )}
              style={draft.status !== 'developing' && draft.status !== 'brainstorming'
                ? { backgroundColor: DRAFT_STATUS_COLORS[draft.status] }
                : undefined
              }
            />
            <span className={cn(
              'text-[11px] font-medium',
              draft.status === 'developing' ? 'text-status-running' :
              draft.status === 'brainstorming' ? 'text-accent-primary' :
              'text-text-muted'
            )}
              style={draft.status !== 'developing' && draft.status !== 'brainstorming'
                ? { color: DRAFT_STATUS_COLORS[draft.status] }
                : undefined
              }
            >
              {DRAFT_STATUS_LABELS[draft.status]}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Online users inline */}
          <div className="flex items-center gap-1">
            {displayOnlineUsers.map((user) => (
              <div
                key={user.userId}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
                  user.userId === currentUserId
                    ? 'bg-accent-light text-accent-primary border-accent-primary/20'
                    : 'bg-[rgba(93,138,84,0.1)] text-status-running border-status-running/20'
                )}
              >
                {(user.userName?.[0] || '?').toUpperCase()}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center text-text-muted text-[10px] font-bold">
                +{remainingCount}
              </div>
            )}
            <span className="text-text-muted text-[11px] ml-1">{mergedOnlineUsers.length} 人在线</span>
          </div>

          {/* Action buttons */}
          <button className="h-8 px-3 rounded-lg border border-border-default text-[13px] text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" />
            邀请
          </button>
          <button className="h-8 px-3 rounded-lg border border-border-default text-[13px] text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            历史
          </button>
        </div>
      </div>

      {/* ====== Connection status ====== */}
      <div className="px-5 py-1 border-b border-border-light flex items-center gap-2">
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          isConnected ? 'bg-status-running' : 'bg-status-stopped'
        )} />
        <span className="text-[10px] text-text-muted">
          {isConnected ? '已连接' : '断开连接'}
        </span>
      </div>

      {/* ====== Timeline content ====== */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Left status line */}
        <div className="timeline-line opacity-20" />

        <div className="px-6 py-5 max-w-[720px] mx-auto space-y-4">
          {timelineItems.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-xs">
              暂无内容，发送第一条消息开始讨论
            </div>
          ) : (
            timelineItems.map((item) => {
              switch (item.type) {
                case 'node':
                  return <TimelineNodeItem key={item.id} node={item} />;
                case 'card':
                  return <TimelineCardItem key={item.id} item={item} onClick={() => setSelectedCard(item.card)} onContextMenu={(e) => handleContextMenu(e, item.card)} />;
                case 'message':
                  return <TimelineMessageItem key={item.id} item={item} />;
                default:
                  return null;
              }
            })
          )}
          <div ref={timelineEndRef} />
        </div>
      </div>

      {/* ====== Message input ====== */}
      <MessageInput
        draftId={draft.id}
        replyTo={replyTo}
        onSend={handleSend}
        onCancelReply={() => setReplyTo(null)}
      />

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onReference={(card) => {
          console.log('Reference card:', card.shortId);
          setSelectedCard(null);
        }}
        onExecutePlan={(card) => { /* 后续接入 AI 执行流程 */ }}
        onStartCoding={(card) => { /* 后续接入 AI 执行流程 */ }}
        onResume={(card) => { /* 后续接入 AI 执行流程 */ }}
        onAbort={(card) => { /* 后续接入 AI 执行流程 */ }}
      />

      {contextMenu && (
        <div
          data-testid="card-context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 50 }}
          className="bg-bg-card border border-border-default rounded-lg shadow-lg py-1"
        >
          <button
            data-testid="card-reference-btn"
            className="w-full px-3 py-2 text-left text-[13px] hover:bg-bg-hover transition-colors"
            onClick={() => {
              closeContextMenu();
            }}
          >
            引用此卡片
          </button>
        </div>
      )}
    </div>
  );
}