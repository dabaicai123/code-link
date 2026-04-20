'use client';

import { useState, memo } from 'react';
import type { DraftMessage, MessageConfirmation } from '../../types/draft';
import { api } from '@/lib/api';
import {
  parseAIResponseMetadata,
  AI_COMMAND_TYPE_LABELS,
  type AICommandType,
} from '../../lib/ai-commands';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: DraftMessage;
  currentUserId?: number;
  onReply?: (message: DraftMessage) => void;
  onConfirm?: (messageId: number, type: string) => void;
}

export const MessageItem = memo(function MessageItem({ message, currentUserId, onReply, onConfirm }: MessageItemProps) {
  const [showConfirmations, setShowConfirmations] = useState(false);
  const [confirmations, setConfirmations] = useState<MessageConfirmation[]>([]);
  const [userConfirm, setUserConfirm] = useState<string | null>(null);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleConfirm = async (type: 'agree' | 'disagree' | 'suggest') => {
    try {
      await api.confirmDraftMessage(message.draftId, message.id, type);
      setUserConfirm(type);
      onConfirm?.(message.id, type);
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
  };

  const loadConfirmations = async () => {
    try {
      const result = await api.getDraftMessageConfirmations(message.draftId, message.id);
      setConfirmations(result.confirmations as MessageConfirmation[]);
      const userConf = result.confirmations.find((c) => c.userId === currentUserId);
      if (userConf) {
        setUserConfirm(userConf.type);
      }
    } catch (err) {
      console.error('Failed to load confirmations:', err);
    }
  };

  const handleShowConfirmations = () => {
    if (!showConfirmations) {
      loadConfirmations();
    }
    setShowConfirmations(!showConfirmations);
  };

  const isCode = message.messageType === 'code';
  const isAICommand = message.messageType === 'ai_command';
  const isAIResponse =
    message.messageType === 'ai_response' ||
    (message.messageType === 'system' && message.userName === 'AI 助手');
  const isSystem = message.messageType === 'system' && message.userName !== 'AI 助手';

  // 解析 AI 响应元数据
  const aiMetadata = isAIResponse ? parseAIResponseMetadata(message.metadata) : null;

  // 获取 AI 命令类型标签
  const getAICommandTypeLabel = (commandType?: AICommandType): string => {
    if (!commandType) return 'AI 响应';
    return AI_COMMAND_TYPE_LABELS[commandType] || 'AI 响应';
  };

  if (isSystem) {
    return (
      <div className="py-2 px-3 text-center">
        <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-md">
          {message.content}
        </span>
      </div>
    );
  }

  // AI 响应特殊样式
  if (isAIResponse) {
    return (
      <div className="p-3 bg-primary/5 rounded-md m-1">
        <div className="flex gap-2">
          {/* AI 头像 */}
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
            AI
          </div>

          {/* AI 响应内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary">AI 助手</span>
              <span className="text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
              {aiMetadata?.commandType && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-accent-light border border-primary">
                  {getAICommandTypeLabel(aiMetadata.commandType)}
                </span>
              )}
            </div>

            <div className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {/* AI 元数据 */}
            {aiMetadata && (aiMetadata.model || aiMetadata.inputTokens || aiMetadata.outputTokens) && (
              <div className="mt-2 flex gap-3 flex-wrap text-[10px] text-muted-foreground">
                {aiMetadata.model && <span>模型: {aiMetadata.model}</span>}
                {aiMetadata.inputTokens && <span>输入: {aiMetadata.inputTokens} tokens</span>}
                {aiMetadata.outputTokens && <span>输出: {aiMetadata.outputTokens} tokens</span>}
              </div>
            )}

            {aiMetadata?.error && (
              <div className="mt-2 p-1.5 bg-destructive/10 rounded text-[11px] text-destructive">
                错误: {aiMetadata.error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="flex gap-2">
        {/* 头像 */}
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0',
            isAICommand ? 'bg-primary text-white' : 'bg-hover text-foreground'
          )}
        >
          {isAICommand ? 'AI' : (message.userName?.[0] || '?').toUpperCase()}
        </div>

        {/* 消息内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-xs font-medium text-foreground">
              {isAICommand ? 'AI 助手' : message.userName || '未知用户'}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
          </div>

          {/* AI 指令标签 */}
          {isAICommand && (
            <div className="mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-accent-light border border-primary">
                @AI 指令
              </span>
            </div>
          )}

          {isCode ? (
            <pre className="m-0 p-2 bg-secondary rounded text-[11px] font-mono overflow-auto whitespace-pre-wrap break-all">
              {message.content}
            </pre>
          ) : (
            <div className="text-[13px] text-foreground leading-relaxed break-words">
              {message.content}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => handleConfirm('agree')}
              className={cn(
                'px-1.5 py-0.5 text-[10px] border-none rounded',
                userConfirm === 'agree' ? 'bg-status-running text-white' : 'bg-hover text-muted-foreground'
              )}
            >
              + 赞同
            </button>
            <button
              onClick={() => handleConfirm('disagree')}
              className={cn(
                'px-1.5 py-0.5 text-[10px] border-none rounded',
                userConfirm === 'disagree' ? 'bg-status-stopped text-white' : 'bg-hover text-muted-foreground'
              )}
            >
              - 反对
            </button>
            <button
              onClick={() => handleConfirm('suggest')}
              className={cn(
                'px-1.5 py-0.5 text-[10px] border-none rounded',
                userConfirm === 'suggest' ? 'bg-status-warning text-white' : 'bg-hover text-muted-foreground'
              )}
            >
              * 建议
            </button>
            <button
              onClick={() => onReply?.(message)}
              className="px-1.5 py-0.5 text-[10px] border-none rounded bg-hover text-muted-foreground"
            >
              回复
            </button>
            <button
              onClick={handleShowConfirmations}
              className="px-1.5 py-0.5 text-[10px] border-none rounded bg-transparent text-muted-foreground"
            >
              {showConfirmations ? '隐藏' : '详情'}
            </button>
          </div>

          {/* 确认详情 */}
          {showConfirmations && confirmations.length > 0 && (
            <div className="mt-2 p-2 bg-secondary rounded">
              {confirmations.map((conf) => (
                <div key={conf.id} className="flex items-center gap-1.5 mb-1 text-[11px]">
                  <span className="text-foreground">{conf.userName}</span>
                  <span
                    className={cn(
                      'px-1 py-0.5 rounded text-[9px] text-white',
                      conf.type === 'agree' ? 'bg-status-running' :
                      conf.type === 'disagree' ? 'bg-status-stopped' : 'bg-status-warning'
                    )}
                  >
                    {conf.type === 'agree' ? '赞同' : conf.type === 'disagree' ? '反对' : '建议'}
                  </span>
                  {conf.comment && (
                    <span className="text-muted-foreground">: {conf.comment}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
