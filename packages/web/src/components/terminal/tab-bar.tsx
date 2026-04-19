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
    <div className="flex items-center h-8 bg-secondary border-b border-border px-2 pt-1">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          className={cn(
            'px-3 py-1 text-xs cursor-pointer flex items-center gap-1.5 -mb-px border border-b-0',
            activeTabId === tab.id
              ? 'bg-primary text-primary-foreground border-border rounded-t-md'
              : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'
          )}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              className="text-[10px] text-muted-foreground opacity-60 hover:opacity-100"
            >
              ✕
            </span>
          )}
        </div>
      ))}
      <div
        onClick={onNewTab}
        className="px-3 py-1 text-muted-foreground text-xs cursor-pointer hover:bg-muted"
      >
        +
      </div>
    </div>
  );
}
