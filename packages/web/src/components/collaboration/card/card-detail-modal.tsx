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
        className="bg-white rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1"
              style={{ backgroundColor: STATUS_COLORS[card.cardStatus] }}
            />
            <div className="flex-1">
              <div className="text-base font-semibold text-gray-900 leading-snug break-words">
                {card.title}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span style={{ color: CARD_TYPE_COLORS[card.cardType] }}>
                  {CARD_TYPE_LABELS[card.cardType]}
                </span>
                <span>{card.createdByName}</span>
                <span>{new Date(card.createdAt).toLocaleString('zh-CN')}</span>
                {card.parentCardId && (
                  <span className="text-blue-500">↑ @{card.shortId}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {card.result}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-2">
          {isCompleted && (
            <>
              {isBrainstorming && onExecutePlan && (
                <button
                  onClick={() => onExecutePlan(card)}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
                >
                  执行计划
                </button>
              )}
              {isWritingPlans && onStartCoding && (
                <button
                  onClick={() => onStartCoding(card)}
                  className="px-5 py-2 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600"
                >
                  开始编码
                </button>
              )}
              {!isBrainstorming && !isWritingPlans && onConfirm && (
                <button
                  onClick={() => onConfirm(card)}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
                >
                  确认继续
                </button>
              )}
              {onReference && (
                <button
                  onClick={() => onReference(card)}
                  className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200"
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
                  className="px-5 py-2 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600"
                >
                  继续执行
                </button>
              )}
              {onAbort && (
                <button
                  onClick={() => onAbort(card)}
                  className="px-5 py-2 text-sm font-medium text-red-500 border border-red-300 rounded hover:bg-red-50"
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
                className="px-5 py-2 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600"
              >
                继续执行
              </button>
              <button
                onClick={() => onAbort?.(card)}
                className="px-5 py-2 text-sm font-medium text-red-500 border border-red-300 rounded hover:bg-red-50"
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