'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useDraftSocket } from '@/lib/socket/draft';
import { MessageItem } from './message-item';
import { MessageInput } from './message-input';
import type { Draft, DraftMessage, MessageType } from '../../types/draft';
import { cn } from '@/lib/utils';
import { Loading } from '@/components/ui/loading';

interface MessagePanelProps {
  draft: Draft;
  currentUserId?: number;
  currentUserName?: string;
}

export function MessagePanel({ draft, currentUserId, currentUserName }: MessagePanelProps) {
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<DraftMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // WebSocket 回调
  const handleMessageReceived = useCallback((msg: { message: DraftMessage }) => {
    const draftMessage = msg.message;
    setMessages(prev => {
      // 避免重复添加
      if (prev.some(m => m.id === draftMessage.id)) return prev;
      return [...prev, draftMessage];
    });
    setTimeout(scrollToBottom, 50);
  }, []);

  const { isConnected, onlineUsers } = useDraftSocket({
    draftId: draft.id,
    onMessage: handleMessageReceived,
  });

  // 加载历史消息
  useEffect(() => {
    loadMessages();
  }, [draft.id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await api.getDraftMessages(draft.id, { limit: 100 });
      setMessages(result.messages);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (content: string, messageType: MessageType, parentId?: number) => {
    const result = await api.sendDraftMessage(draft.id, {
      content,
      messageType,
      parentId,
    });
    // WebSocket 会广播消息，这里不需要手动添加
  };

  const handleConfirm = (messageId: number, type: string) => {
    // 更新本地状态
  };

  // 按层级组织消息（简化版，不支持深层嵌套）
  const rootMessages = messages.filter(m => m.parentId === null);
  const getReplies = (parentId: number) => messages.filter(m => m.parentId === parentId);

  if (loading) {
    return <Loading className="h-full" />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* 连接状态 */}
      <div className="px-3 py-1 border-b border-border flex items-center gap-2">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isConnected ? 'bg-status-running' : 'bg-status-stopped'
          )}
        />
        <span className="text-[10px] text-muted-foreground">
          {isConnected ? '已连接' : '断开连接'}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {onlineUsers.length} 人在线
        </span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto">
        {rootMessages.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-xs">
            暂无消息，发送第一条消息开始讨论
          </div>
        ) : (
          rootMessages.map((message) => (
            <div key={message.id}>
              <MessageItem
                message={message}
                currentUserId={currentUserId}
                onReply={setReplyTo}
                onConfirm={handleConfirm}
              />
              {/* 显示回复 */}
              {getReplies(message.id).map((reply) => (
                <div key={reply.id} className="pl-9">
                  <MessageItem
                    message={reply}
                    currentUserId={currentUserId}
                    onReply={setReplyTo}
                    onConfirm={handleConfirm}
                  />
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <MessageInput
        draftId={draft.id}
        replyTo={replyTo}
        onSend={handleSend}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}