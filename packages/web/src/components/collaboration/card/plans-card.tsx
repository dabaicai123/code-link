'use client';

import { CardContainer } from './card-container';
import type { Card } from '@/types/card';

interface PlansCardProps {
  card: Card;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onStartCoding?: () => void;
}

export function PlansCard({ card, onClick, onContextMenu, onStartCoding }: PlansCardProps) {
  const isCompleted = card.cardStatus === 'completed';

  return (
    <CardContainer card={card} onClick={onClick} onContextMenu={onContextMenu}>
      {isCompleted && onStartCoding && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartCoding();
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-success rounded hover:bg-success"
          >
            开始编码
          </button>
        </div>
      )}
    </CardContainer>
  );
}