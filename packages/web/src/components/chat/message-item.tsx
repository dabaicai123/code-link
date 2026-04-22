// packages/web/src/components/chat/message-item.tsx
'use client';

import { cn } from '@/lib/utils';
import { AssistantMessage } from './assistant-message';
import { ToolCallBlock } from './tool-call-block';
import type { ChatMessage } from '@/types/chat';

interface MessageItemProps {
  message: ChatMessage;
  streamingContent?: string;
}

export function MessageItem({ message, streamingContent }: MessageItemProps) {
  if (message.role === 'tool' && message.toolCall) {
    return <ToolCallBlock toolCall={message.toolCall} />;
  }

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div data-role={message.role} data-testid={`message-${message.id}`} className={cn('msg flex gap-3 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className={cn(
          'msg-avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
          isAssistant ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-hover text-text-primary'
        )}>
          C
        </div>
      )}

      <div className={cn(
        'msg-bubble max-w-[80%] px-3 py-2 rounded-2xl text-[13px]',
        isUser
          ? 'bg-accent-primary text-white rounded-br-md'
          : 'bg-bg-card text-text-primary border border-border-default/50 rounded-bl-md'
      )}>
        {isUser ? (
          <div className="msg-text whitespace-pre-wrap">
            {message.content}
            {message.elements?.map((el) => (
              <span key={el.id} className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-white/20 border border-white/40 rounded-sm font-mono text-[11px]">&lt;{el.tagName}&gt;</span>
            ))}
          </div>
        ) : (
          <AssistantMessage
            content={isAssistant && streamingContent ? streamingContent : message.content}
            isStreaming={isAssistant && !!streamingContent}
          />
        )}

        {message.cost && (
          <div className="text-xs text-text-muted mt-1 pt-1 border-t border-border-default/30">
            Tokens: {message.cost.inputTokens} → {message.cost.outputTokens} · Cost: ${message.cost.totalCost.toFixed(4)}
          </div>
        )}
      </div>

      {isUser && (
        <div className="msg-avatar w-8 h-8 rounded-full bg-accent-primary text-white flex items-center justify-center text-xs font-semibold shrink-0">
          U
        </div>
      )}
    </div>
  );
}