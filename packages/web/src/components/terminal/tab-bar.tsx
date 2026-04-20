'use client';

import { cn } from '@/lib/utils';

interface TerminalTab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onNewTab }: TabBarProps) {
  return (
    <div className="flex bg-background border-b border-border">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          className={cn(
            'px-3 py-1.5 text-xs cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px',
            activeTabId === tab.id
              ? 'text-foreground bg-secondary border-primary'
              : 'text-muted-foreground border-transparent hover:bg-muted/50'
          )}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              className="text-[10px] opacity-60 hover:opacity-100"
            >
              ✕
            </span>
          )}
        </div>
      ))}
      <div
        onClick={onNewTab}
        className="px-3 py-1.5 text-muted-foreground text-xs cursor-pointer hover:bg-muted/50"
      >
        +
      </div>
    </div>
  );
}
