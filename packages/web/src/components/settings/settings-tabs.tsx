'use client';

export type SettingsTab = 'organization' | 'claude-code';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'organization', label: '组织' },
  { id: 'claude-code', label: 'Claude Code' },
];

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <div
      style={{
        width: '140px',
        padding: '16px 0',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            backgroundColor: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '14px',
            textAlign: 'left',
            cursor: 'pointer',
            borderLeft: activeTab === tab.id ? '3px solid var(--accent-color)' : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
