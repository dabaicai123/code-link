// packages/web/src/components/chat/welcome-screen.tsx
'use client';

import { Flower2 } from 'lucide-react';

export function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <Flower2 className="w-10 h-10 text-accent-primary opacity-60 mb-4" />
      <h3 className="text-lg font-medium text-text-primary mb-2">欢迎使用 Code-Link</h3>
      <p className="text-sm text-text-muted">开始与 Claude 对话</p>
    </div>
  );
}