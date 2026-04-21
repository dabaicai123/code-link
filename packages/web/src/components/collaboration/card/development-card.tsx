'use client';

import { CardContainer } from './card-container';
import type { Card } from '@/types/card';

interface DevelopmentCardProps {
  card: Card;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onPause?: () => void;
  onResume?: () => void;
  onAbort?: () => void;
}

export function DevelopmentCard({
  card,
  onClick,
  onContextMenu,
  onPause,
  onResume,
  onAbort,
}: DevelopmentCardProps) {
  const isRunning = card.cardStatus === 'running';
  const isPaused = card.cardStatus === 'paused';

  return (
    <CardContainer card={card} onClick={onClick} onContextMenu={onContextMenu}>
      {isRunning && (
        <div className="mt-2 flex items-center gap-2">
          <div className="text-xs text-success animate-pulse flex-1">
            正在执行开发任务...
          </div>
          {onPause && (
            <button
              onClick={(e) => { e.stopPropagation(); onPause(); }}
              className="px-2 py-1 text-xs text-warning border border-warning rounded hover:bg-warning/10"
            >
              暂停
            </button>
          )}
        </div>
      )}
      {isPaused && (
        <div className="mt-2 flex items-center gap-2">
          <div className="text-xs text-warning flex-1">
            开发任务已暂停
          </div>
          {onResume && (
            <button
              onClick={(e) => { e.stopPropagation(); onResume(); }}
              className="px-2 py-1 text-xs text-white bg-success rounded hover:bg-success"
            >
              继续
            </button>
          )}
          {onAbort && (
            <button
              onClick={(e) => { e.stopPropagation(); onAbort(); }}
              className="px-2 py-1 text-xs text-destructive border border-destructive rounded hover:bg-destructive/10"
            >
              放弃
            </button>
          )}
        </div>
      )}
    </CardContainer>
  );
}