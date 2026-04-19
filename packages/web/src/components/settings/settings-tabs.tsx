'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type SettingsTab = 'organization' | 'claude-code';

export interface SettingsTabsProps {
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
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as SettingsTab)} orientation="vertical">
        <TabsList className="flex-col h-auto bg-transparent gap-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="w-full justify-start px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}