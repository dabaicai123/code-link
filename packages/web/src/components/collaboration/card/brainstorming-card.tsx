'use client';

import { CardContainer } from './card-container';
import type { Card } from '@/types/card';

interface BrainstormingCardProps {
  card: Card;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onExecutePlan?: () => void;
}

export function BrainstormingCard({ card, onClick, onContextMenu, onExecutePlan }: BrainstormingCardProps) {
  const isCompleted = card.cardStatus === 'completed';

  return (
    <CardContainer card={card} onClick={onClick} onContextMenu={onContextMenu}>
      {isCompleted && onExecutePlan && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecutePlan();
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
          >
            执行计划
          </button>
        </div>
      )}
    </CardContainer>
  );
}