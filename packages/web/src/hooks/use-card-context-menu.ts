'use client';

import { useState, useCallback } from 'react';
import type { Card } from '@/types/card';

interface ContextMenuState {
  card: Card;
  x: number;
  y: number;
}

export function useCardContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    setContextMenu({ card, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
  };
}