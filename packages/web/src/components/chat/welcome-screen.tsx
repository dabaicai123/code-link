// packages/web/src/components/chat/welcome-screen.tsx
'use client';

export function WelcomeScreen() {
  return (
    <div className="welcome-msg flex flex-col items-center justify-center h-full text-center py-20">
      <div className="welcome-icon text-5xl mb-4 text-[#c0553a] opacity-60">✿</div>
      <h3 className="text-lg font-medium text-[#2d1f14] mb-2">欢迎使用 Code-Link</h3>
      <p className="text-sm text-[#9a8b7d]">开始与 Claude 对话</p>
    </div>
  );
}