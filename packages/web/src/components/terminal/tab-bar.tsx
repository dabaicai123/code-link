'use client';

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
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          style={{
            padding: '6px 12px',
            color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '12px',
            borderBottom: activeTabId === tab.id ? '2px solid var(--accent-color)' : 'none',
            backgroundColor: activeTabId === tab.id ? 'var(--bg-secondary)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }} style={{ fontSize: '10px', opacity: 0.6 }}>✕</span>
          )}
        </div>
      ))}
      <div onClick={onNewTab} style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>+</div>
    </div>
  );
}
