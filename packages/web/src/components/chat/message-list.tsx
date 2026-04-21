// packages/web/src/components/chat/message-list.tsx
'use client';

import { useRef, useEffect } from 'react';
import { WelcomeScreen } from './welcome-screen';
import { MessageItem } from './message-item';
import type { ChatMessage } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  isRunning: boolean;
}

export function MessageList({ messages, streamingContent, isRunning }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isRunning) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#faf6f0]">
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-[#faf6f0] px-4 py-3">
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          streamingContent={msg.role === 'assistant' && isRunning ? streamingContent : undefined}
        />
      ))}
      {isRunning && streamingContent && !messages.some((m) => m.role === 'assistant' && m.content === '') && (
        <MessageItem
          message={{
            id: 'streaming',
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          }}
          streamingContent={streamingContent}
        />
      )}
    </div>
  );
}