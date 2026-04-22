'use client';

import { useRef, useEffect, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';
import type { DraftMessage, MessageType } from '../../types/draft';

const messageSchema = z.object({
  content: z.string().min(1, '消息不能为空').max(5000, '消息过长'),
});

type MessageInput = z.infer<typeof messageSchema>;

export interface MessageInputHandle {
  insertText: (text: string) => void;
}

interface MessageInputProps {
  draftId: number;
  replyTo?: DraftMessage | null;
  onSend: (content: string, messageType: MessageType, parentId?: number) => Promise<void>;
  onCancelReply?: () => void;
  ref?: React.Ref<MessageInputHandle>;
}

export function MessageInput({ draftId, replyTo, onSend, onCancelReply, ref }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageTypeRef = useRef<MessageType>('text');

  const form = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      content: '',
    },
  });

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const currentContent = form.getValues('content');
      const newContent = currentContent ? `${currentContent} ${text}` : text;
      form.setValue('content', newContent);
      textareaRef.current?.focus();
    },
  }), [form]);

  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const onSubmit = async (values: MessageInput) => {
    try {
      await onSend(values.content.trim(), messageTypeRef.current, replyTo?.id);
      form.reset();
      messageTypeRef.current = 'text';
      onCancelReply?.();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  const onToggleCodeMode = () => {
    messageTypeRef.current = messageTypeRef.current === 'code' ? 'text' : 'code';
  };

  const onInsertAICommand = () => {
    const currentContent = form.getValues('content');
    form.setValue('content', currentContent + '@AI ');
    messageTypeRef.current = 'ai_command';
    textareaRef.current?.focus();
  };

  const content = form.watch('content');
  const messageType = messageTypeRef.current;
  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="p-2 border-t border-border bg-secondary">
      {/* 回复提示 */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-1.5 bg-background rounded-md">
          <span className="text-xs text-muted-foreground">
            回复 {replyTo.userName}:
          </span>
          <span className="text-xs text-foreground flex-1 truncate">
            {replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? '...' : ''}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="px-1.5 py-0.5 text-[10px] rounded bg-hover text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
          <div className="flex-1 relative">
            <FormField
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <textarea
                      {...field}
                      ref={textareaRef}
                      data-testid="collab-message-input"
                      onKeyDown={handleKeyDown}
                      placeholder={
                        messageType === 'code' ? '输入代码...' :
                        messageType === 'ai_command' ? '输入 AI 指令...' :
                        '输入消息...'
                      }
                      className="w-full min-h-[60px] max-h-[150px] p-2 text-sm border border-border rounded-md bg-background text-foreground resize-none outline-none focus:ring-1 focus:ring-primary"
                      style={{
                        fontFamily: messageType === 'code' ? 'monospace' : 'inherit',
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* 类型指示器 */}
            {messageType !== 'text' && (
              <div className="absolute top-1 right-2">
                <span className="text-[9px] px-1 py-0.5 rounded bg-primary text-primary-foreground">
                  {messageType === 'ai_command' ? 'AI 指令' : '代码'}
                </span>
              </div>
            )}
          </div>

          <Button type="submit" size="sm" disabled={!content?.trim() || isSubmitting}>
            {isSubmitting ? '发送中...' : '发送'}
          </Button>
        </form>
      </Form>

      {/* 工具栏 */}
      <div className="flex gap-2 mt-1.5">
        <button
          type="button"
          onClick={onToggleCodeMode}
          className="px-2 py-1 text-[10px] rounded bg-hover text-muted-foreground hover:text-foreground"
        >
          {'</>'}
        </button>
        <button
          type="button"
          onClick={onInsertAICommand}
          className="px-2 py-1 text-[10px] rounded bg-hover text-muted-foreground hover:text-foreground"
        >
          @AI
        </button>
      </div>
    </div>
  );
}