'use client';

import { BrainstormingCard } from './brainstorming-card';
import { PlansCard } from './plans-card';
import { DevelopmentCard } from './development-card';
import { CardContainer } from './card-container';
import type { Card } from '@/types/card';

interface CardRendererProps {
  card: Card;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onExecutePlan?: () => void;
  onStartCoding?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onAbort?: () => void;
}

export function CardRenderer({
  card,
  onClick,
  onContextMenu,
  onExecutePlan,
  onStartCoding,
  onPause,
  onResume,
  onAbort,
}: CardRendererProps) {
  switch (card.cardType) {
    case 'brainstorming':
      return (
        <BrainstormingCard
          card={card}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onExecutePlan={onExecutePlan}
        />
      );
    case 'writing_plans':
      return (
        <PlansCard
          card={card}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onStartCoding={onStartCoding}
        />
      );
    case 'development':
      return (
        <DevelopmentCard
          card={card}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onPause={onPause}
          onResume={onResume}
          onAbort={onAbort}
        />
      );
    case 'test':
    case 'archive':
    default:
      return (
        <CardContainer
          card={card}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      );
  }
}

export { CardContainer } from './card-container';
export { BrainstormingCard } from './brainstorming-card';
export { PlansCard } from './plans-card';
export { DevelopmentCard } from './development-card';