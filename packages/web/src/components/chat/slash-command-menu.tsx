// packages/web/src/components/chat/slash-command-menu.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const SLASH_COMMANDS = [
  { cmd: '/clear', desc: '清除当前会话' },
  { cmd: '/model', desc: '查看/切换模型' },
  { cmd: '/mode', desc: '查看/切换权限模式' },
  { cmd: '/cost', desc: '查看会话费用' },
  { cmd: '/compact', desc: '压缩上下文' },
  { cmd: '/init', desc: '生成/更新 Agent 指南文件' },
];

interface SlashCommandMenuProps {
  filter: string;
  onSelect: (cmd: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ filter, onSelect, onClose }: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter(
    (c) => c.cmd.startsWith(filter) || c.desc.includes(filter.slice(1))
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex].cmd);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtered, activeIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    onClose();
    return null;
  }

  return (
    <div ref={menuRef} className="cmd-menu">
      {filtered.map((c, i) => (
        <div
          key={c.cmd}
          className={cn('cmd-item', i === activeIndex && 'active')}
          onClick={() => onSelect(c.cmd)}
        >
          <span className="cmd-item-cmd">{c.cmd}</span>
          <span className="cmd-item-desc">{c.desc}</span>
        </div>
      ))}
    </div>
  );
}