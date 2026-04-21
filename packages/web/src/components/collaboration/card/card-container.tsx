'use client';

import type { Card } from '@/types/card';
import { STATUS_COLORS, STATUS_LABELS, CARD_TYPE_COLORS, CARD_TYPE_LABELS } from '@/types/card';

interface CardContainerProps {
  card: Card;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}

export function CardContainer({ card, onClick, onContextMenu, children }: CardContainerProps) {
  return (
    <div
      data-testid="card-container"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow max-w-md"
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: STATUS_COLORS[card.cardStatus] }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 leading-snug break-words">
            {card.title}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span style={{ color: CARD_TYPE_COLORS[card.cardType] }}>
              {CARD_TYPE_LABELS[card.cardType]}
            </span>
            <span>{card.createdByName}</span>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {STATUS_LABELS[card.cardStatus]}
        </span>
      </div>

      <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
        {card.summary}
      </div>

      {card.parentCardId && (
        <div className="text-xs text-blue-500 mt-2">
          ↑ 引用自 @{card.shortId}
        </div>
      )}

      {children}
    </div>
  );
}