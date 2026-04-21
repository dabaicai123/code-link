'use client';

import type { Card } from '@/types/card';
import { STATUS_COLORS, STATUS_LABELS, CARD_TYPE_COLORS, CARD_TYPE_LABELS } from '@/types/card';

interface CardDetailModalProps {
  card: Card | null;
  onClose: () => void;
  onReference?: (card: Card) => void;
  onConfirm?: (card: Card) => void;
  onExecutePlan?: (card: Card) => void;
  onStartCoding?: (card: Card) => void;
  onResume?: (card: Card) => void;
  onAbort?: (card: Card) => void;
}

export function CardDetailModal({
  card,
  onClose,
  onReference,
  onConfirm,
  onExecutePlan,
  onStartCoding,
  onResume,
  onAbort,
}: CardDetailModalProps) {
  if (!card) return null;

  const isCompleted = card.cardStatus === 'completed';
  const isPaused = card.cardStatus === 'paused';
  const isBrainstorming = card.cardType === 'brainstorming';
  const isWritingPlans = card.cardType === 'writing_plans';
  const isDevelopment = card.cardType === 'development';

  return (
    <div
      data-testid="card-detail-modal"
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-muted">
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1"
              style={{ backgroundColor: STATUS_COLORS[card.cardStatus] }}
            />
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground leading-snug break-words">
                {card.title}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span style={{ color: CARD_TYPE_COLORS[card.cardType] }}>
                  {CARD_TYPE_LABELS[card.cardType]}
                </span>
                <span>{card.createdByName}</span>
                <span>{new Date(card.createdAt).toLocaleString('zh-CN')}</span>
                {card.parentCardId && (
                  <span className="text-primary">↑ @{card.shortId}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-muted-foreground text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-muted">
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {card.result}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-muted flex gap-2">
          {isCompleted && (
            <>
              {isBrainstorming && onExecutePlan && (
                <button
                  onClick={() => onExecutePlan(card)}
                  className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary"
                >
                  执行计划
                </button>
              )}
              {isWritingPlans && onStartCoding && (
                <button
                  onClick={() => onStartCoding(card)}
                  className="px-5 py-2 text-sm font-medium text-success-foreground bg-success rounded hover:bg-success"
                >
                  开始编码
                </button>
              )}
              {!isBrainstorming && !isWritingPlans && onConfirm && (
                <button
                  onClick={() => onConfirm(card)}
                  className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary"
                >
                  确认继续
                </button>
              )}
              {onReference && (
                <button
                  onClick={() => onReference(card)}
                  className="px-5 py-2 text-sm font-medium text-muted-foreground bg-muted border border-muted rounded hover:bg-muted"
                >
                  引用迭代
                </button>
              )}
            </>
          )}

          {isPaused && isDevelopment && (
            <>
              {onResume && (
                <button
                  onClick={() => onResume(card)}
                  className="px-5 py-2 text-sm font-medium text-success-foreground bg-success rounded hover:bg-success"
                >
                  继续执行
                </button>
              )}
              {onAbort && (
                <button
                  onClick={() => onAbort(card)}
                  className="px-5 py-2 text-sm font-medium text-destructive border border-destructive rounded hover:bg-destructive/10"
                >
                  放弃
                </button>
              )}
            </>
          )}

          {isPaused && !isDevelopment && onReference && (
            <>
              <button
                onClick={() => onReference(card)}
                className="px-5 py-2 text-sm font-medium text-success-foreground bg-success rounded hover:bg-success"
              >
                继续执行
              </button>
              <button
                onClick={() => onAbort?.(card)}
                className="px-5 py-2 text-sm font-medium text-destructive border border-destructive rounded hover:bg-destructive/10"
              >
                放弃
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}