'use client';

import { useState, useRef, useEffect } from 'react';
import type { DraftMessage, MessageType } from '../../types/draft';

interface MessageInputProps {
  draftId: number;
  replyTo?: DraftMessage | null;
  onSend: (content: string, messageType: MessageType, parentId?: number) => Promise<void>;
  onCancelReply?: () => void;
}

export function MessageInput({ draftId, replyTo, onSend, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>('text');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      await onSend(content.trim(), messageType, replyTo?.id);
      setContent('');
      setMessageType('text');
      onCancelReply?.();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleCodeMode = () => {
    setMessageType(prev => prev === 'code' ? 'text' : 'code');
  };

  const insertAICommand = () => {
    setContent(prev => prev + '@AI ');
    setMessageType('ai_command');
    textareaRef.current?.focus();
  };

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* 回复提示 */}
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '6px 8px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            回复 {replyTo.user_name}:
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? '...' : ''}
          </span>
          <button
            onClick={onCancelReply}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messageType === 'code' ? '输入代码...' : messageType === 'ai_command' ? '输入 AI 指令...' : '输入消息...'}
            style={{
              width: '100%',
              minHeight: '60px',
              maxHeight: '150px',
              padding: '8px 10px',
              fontSize: '13px',
              fontFamily: messageType === 'code' ? 'monospace' : 'inherit',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
            }}
          />

          {/* 类型指示器 */}
          {messageType !== 'text' && (
            <div style={{ position: 'absolute', top: '4px', right: '8px' }}>
              <span
                style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: messageType === 'ai_command' ? 'var(--accent-color)' : 'var(--bg-hover)',
                  color: messageType === 'ai_command' ? 'white' : 'var(--text-secondary)',
                }}
              >
                {messageType === 'ai_command' ? 'AI 指令' : '代码'}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="btn"
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              opacity: !content.trim() || sending ? 0.5 : 1,
            }}
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button
          onClick={toggleCodeMode}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: messageType === 'code' ? 'var(--accent-color)' : 'var(--bg-hover)',
            color: messageType === 'code' ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {'</>'}
        </button>
        <button
          onClick={insertAICommand}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: messageType === 'ai_command' ? 'var(--accent-color)' : 'var(--bg-hover)',
            color: messageType === 'ai_command' ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          @AI
        </button>
      </div>
    </div>
  );
}