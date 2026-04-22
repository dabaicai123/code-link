// packages/web/src/components/chat/welcome-screen.tsx
'use client';

import { Layers, Terminal, FileText, AlertCircle } from 'lucide-react';

export function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mb-4">
        <Layers className="w-7 h-7 text-accent-primary" />
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-1">欢迎使用 Code Link</h3>
      <p className="text-[14px] text-text-muted mb-6">选择项目后开始与 AI 对话协作</p>
      <div className="flex flex-col gap-2.5 w-full max-w-[420px]">
        <div className="px-4 py-3 bg-bg-card border border-border-default rounded-lg text-[13px] text-text-secondary cursor-pointer hover:bg-bg-hover transition-colors flex items-center gap-3">
          <Terminal className="w-4 h-4 text-accent-primary" />
          帮我重构这个组件的样式
        </div>
        <div className="px-4 py-3 bg-bg-card border border-border-default rounded-lg text-[13px] text-text-secondary cursor-pointer hover:bg-bg-hover transition-colors flex items-center gap-3">
          <FileText className="w-4 h-4 text-accent-primary" />
          解释这段代码的架构
        </div>
        <div className="px-4 py-3 bg-bg-card border border-border-default rounded-lg text-[13px] text-text-secondary cursor-pointer hover:bg-bg-hover transition-colors flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-accent-primary" />
          找出这个 bug 的原因
        </div>
      </div>
    </div>
  );
}