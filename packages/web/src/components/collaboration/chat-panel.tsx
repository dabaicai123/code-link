'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useDraftSocket } from '@/lib/socket/draft';
import { ChatInput } from './chat-input';
import type { Draft, DraftMessage, MessageType } from '../../types/draft';
import { cn } from '@/lib/utils';
import { Loading } from '@/components/ui/loading';
import { User, Bot, Code, Image as ImageIcon } from 'lucide-react';

interface ChatPanelProps {
  draft: Draft;
  currentUserId?: number;
  currentUserName?: string;
}

// 格式化时间
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 渲染消息内容（支持图片、代码等）
function MessageContent({ message }: { message: DraftMessage }) {
  // 检查是否有图片附件
  const hasImage = message.messageType === 'image';
  const isCode = message.messageType === 'code';
  const isAI = message.messageType === 'ai_command' || message.messageType === 'ai_response';

  // 解析元数据获取图片 URL
  let imageUrl: string | null = null;
  if (hasImage && message.metadata) {
    try {
      const meta = JSON.parse(message.metadata);
      imageUrl = meta.imageUrl || meta.url;
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-1">
      {/* 图片 */}
      {hasImage && imageUrl && (
        <img
          src={imageUrl}
          alt="附件图片"
          className="max-w-full max-h-64 rounded border border-border"
        />
      )}

      {/* 文本内容 */}
      <div className={cn(
        'text-[13px] text-foreground leading-relaxed break-words',
        isCode && 'font-mono text-[12px]'
      )}>
        {message.content}
      </div>
    </div>
  );
}

// 单条消息组件
function ChatMessage({
  message,
  currentUserId,
  onReply,
}: {
  message: DraftMessage;
  currentUserId?: number;
  onReply: (msg: DraftMessage) => void;
}) {
  const isAI = message.messageType === 'ai_command' || message.messageType === 'ai_response' || message.messageType === 'system';
  const isCode = message.messageType === 'code';
  const isSystem = message.messageType === 'system';

  // 检测斜杠命令类型
  const getSlashCommandLabel = (content: string): string | null => {
    if (!content.startsWith('/')) return null;
    const match = content.match(/^\/(\w+)/);
    return match ? match[1] : null;
  };

  const slashCommand = isAI ? getSlashCommandLabel(message.content) : null;

  if (isSystem) {
    return (
      <div className="py-2 px-3 text-center">
        <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-md">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 hover:bg-accent/30 transition-colors group">
      <div className="flex gap-2.5">
        {/* 头像 */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            isAI ? 'bg-primary/10' : 'bg-accent'
          )}
        >
          {isAI ? (
            <Bot className="w-4 h-4 text-primary" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-xs font-medium',
              isAI ? 'text-primary' : 'text-foreground'
            )}>
              {isAI ? 'Claude' : message.userName || '用户'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
            {/* 斜杠命令标签 */}
            {slashCommand && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                /{slashCommand}
              </span>
            )}
            {/* 代码标签 */}
            {isCode && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                <Code className="w-3 h-3 inline mr-0.5" />
                代码
              </span>
            )}
          </div>

          <MessageContent message={message} />

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onReply(message)}
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              回复
            </button>
            <button
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              复制
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatPanel({ draft, currentUserId, currentUserName }: ChatPanelProps) {
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<DraftMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // WebSocket 回调
  const handleMessageReceived = useCallback((msg: {
    draftId: number;
    message: {
      id: number;
      draft_id: number;
      parent_id: number | null;
      user_id: number;
      user_name: string;
      content: string;
      message_type: string;
      metadata: string | null;
      created_at: string;
    };
    timestamp: string;
  }) => {
    const draftMessage: DraftMessage = {
      id: msg.message.id,
      draftId: msg.message.draft_id,
      parentId: msg.message.parent_id,
      userId: msg.message.user_id,
      userName: msg.message.user_name,
      content: msg.message.content,
      messageType: msg.message.message_type as MessageType,
      metadata: msg.message.metadata,
      createdAt: msg.message.created_at,
      updatedAt: msg.message.created_at,
    };
    setMessages(prev => {
      if (prev.some(m => m.id === draftMessage.id)) return prev;
      return [...prev, draftMessage];
    });
    setTimeout(scrollToBottom, 50);
  }, []);

  const { isConnected, onlineUsers } = useDraftSocket({
    draftId: draft.id,
    onMessage: handleMessageReceived,
  });

  const loadMessages = useCallback(async () => {
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
  }, [draft.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 发送消息（支持图片附件）
  const handleSend = async (
    content: string,
    messageType: MessageType,
    parentId?: number,
    attachments?: File[]
  ) => {
    // 如果有图片，先上传
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('content', content);

        await api.sendDraftMessage(draft.id, {
          content,
          messageType: 'image',
          parentId,
          metadata: { fileName: file.name },
        });
      }
      return;
    }

    // 普通消息
    await api.sendDraftMessage(draft.id, {
      content,
      messageType,
      parentId,
    });
  };

  if (loading) {
    return <Loading className="h-full" />;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 头部状态栏 */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-secondary/50">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          )}
        />
        <span className="text-xs text-muted-foreground">
          {isConnected ? '已连接' : '断开连接'}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {onlineUsers.length} 人在线
        </span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-muted-foreground text-sm mb-2">
              开始对话
            </div>
            <div className="text-muted-foreground text-xs space-y-1">
              <p>输入 <kbd className="px-1 py-0.5 bg-accent rounded text-[10px]">/</kbd> 打开命令菜单</p>
              <p>粘贴或点击 📷 上传图片</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              onReply={setReplyTo}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <ChatInput
        draftId={draft.id}
        replyTo={replyTo}
        onSend={handleSend}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
