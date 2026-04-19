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
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      padding: '4px 8px 0',
    }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          style={{
            padding: '6px 12px',
            color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            backgroundColor: activeTabId === tab.id ? 'var(--bg-primary)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '-1px',
            border: activeTabId === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
            borderBottom: activeTabId === tab.id ? '1px solid var(--bg-primary)' : '1px solid var(--border-color)',
          }}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                opacity: 0.6,
              }}
            >
              ✕
            </span>
          )}
        </div>
      ))}
      <div
        onClick={onNewTab}
        style={{
          padding: '6px 12px',
          color: 'var(--text-muted)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        +
      </div>
    </div>
  );
}