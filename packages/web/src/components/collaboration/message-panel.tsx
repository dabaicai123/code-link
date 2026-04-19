'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { draftsApi } from '../../lib/drafts-api';
import { useDraftWebSocket } from '../../hooks/use-draft-websocket';
import { MessageItem } from './message-item';
import { MessageInput } from './message-input';
import type { Draft, DraftMessage, MessageType } from '../../types/draft';

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
  const handleMessageReceived = useCallback((message: unknown) => {
    const draftMessage = message as DraftMessage;
    setMessages(prev => {
      // 避免重复添加
      if (prev.some(m => m.id === draftMessage.id)) return prev;
      return [...prev, draftMessage];
    });
    setTimeout(scrollToBottom, 50);
  }, []);

  const { isConnected, onlineUsers } = useDraftWebSocket({
    draftId: draft.id,
    userId: currentUserId || 0,
    userName: currentUserName || 'Unknown',
    onMessageReceived: handleMessageReceived,
  });

  // 加载历史消息
  useEffect(() => {
    loadMessages();
  }, [draft.id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await draftsApi.getMessages(draft.id, { limit: 100 });
      setMessages(result.messages);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (content: string, messageType: MessageType, parentId?: number) => {
    const result = await draftsApi.sendMessage(draft.id, {
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
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 连接状态 */}
      <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isConnected ? 'var(--status-running)' : 'var(--status-stopped)',
          }}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          {isConnected ? '已连接' : '断开连接'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {onlineUsers.length} 人在线
        </span>
      </div>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rootMessages.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
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
                <div key={reply.id} style={{ paddingLeft: '36px' }}>
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