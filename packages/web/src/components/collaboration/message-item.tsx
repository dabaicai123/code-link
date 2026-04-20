'use client';

import { useState, memo } from 'react';
import type { DraftMessage, MessageConfirmation } from '../../types/draft';
import { api } from '@/lib/api';
import {
  parseAIResponseMetadata,
  AI_COMMAND_TYPE_LABELS,
  type AICommandType,
} from '../../lib/ai-commands';

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
      <div style={{ padding: '8px 12px', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  // AI 响应特殊样式
  if (isAIResponse) {
    return (
      <div style={{ padding: '12px', backgroundColor: 'rgba(124, 58, 237, 0.05)', borderRadius: 'var(--radius-md)', margin: '4px 8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* AI 头像 - 使用渐变色 */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 600,
              color: 'white',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
            }}
          >
            AI
          </div>

          {/* AI 响应内容 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-color)' }}>
                AI 助手
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {formatTime(message.createdAt)}
              </span>
              {/* AI 命令类型标签 */}
              {aiMetadata?.commandType && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(124, 58, 237, 0.15)',
                    color: 'var(--accent-light)',
                    border: '1px solid var(--accent-color)',
                  }}
                >
                  {getAICommandTypeLabel(aiMetadata.commandType)}
                </span>
              )}
            </div>

            {/* AI 响应内容 */}
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {message.content}
            </div>

            {/* AI 元数据信息 */}
            {aiMetadata && (aiMetadata.model || aiMetadata.inputTokens || aiMetadata.outputTokens) && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {aiMetadata.model && (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    模型: {aiMetadata.model}
                  </span>
                )}
                {aiMetadata.inputTokens && (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    输入: {aiMetadata.inputTokens} tokens
                  </span>
                )}
                {aiMetadata.outputTokens && (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    输出: {aiMetadata.outputTokens} tokens
                  </span>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {aiMetadata?.error && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  color: 'var(--status-error)',
                }}
              >
                错误: {aiMetadata.error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* 头像 */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: isAICommand ? 'var(--accent-primary)' : 'var(--bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: isAICommand ? 'white' : 'var(--text-primary)',
            flexShrink: 0,
          }}
        >
          {isAICommand ? 'AI' : (message.userName?.[0] || '?').toUpperCase()}
        </div>

        {/* 消息内容 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {isAICommand ? 'AI 助手' : message.userName || '未知用户'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {formatTime(message.createdAt)}
            </span>
          </div>

          {/* 消息文本/代码 */}
          {isCode ? (
            <pre
              style={{
                margin: 0,
                padding: '8px 10px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontFamily: 'monospace',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {message.content}
            </pre>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {message.content}
            </div>
          )}

          {/* AI 指令标签 */}
          {isAICommand && (
            <div style={{ marginTop: '4px' }}>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(124, 58, 237, 0.15)',
                  color: 'var(--accent-light)',
                  border: '1px solid var(--accent-color)',
                }}
              >
                @AI 指令
              </span>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            {/* 确认按钮 */}
            <button
              onClick={() => handleConfirm('agree')}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: userConfirm === 'agree' ? 'var(--status-running)' : 'var(--bg-hover)',
                color: userConfirm === 'agree' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="赞同"
            >
              + 赞同
            </button>
            <button
              onClick={() => handleConfirm('disagree')}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: userConfirm === 'disagree' ? 'var(--status-stopped)' : 'var(--bg-hover)',
                color: userConfirm === 'disagree' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="反对"
            >
              - 反对
            </button>
            <button
              onClick={() => handleConfirm('suggest')}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: userConfirm === 'suggest' ? 'var(--status-warning)' : 'var(--bg-hover)',
                color: userConfirm === 'suggest' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="建议"
            >
              * 建议
            </button>

            {/* 回复按钮 */}
            <button
              onClick={() => onReply?.(message)}
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
              回复
            </button>

            {/* 查看确认 */}
            <button
              onClick={handleShowConfirmations}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {showConfirmations ? '隐藏' : '详情'}
            </button>
          </div>

          {/* 确认详情 */}
          {showConfirmations && confirmations.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              {confirmations.map((conf) => (
                <div key={conf.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{conf.userName}</span>
                  <span
                    style={{
                      padding: '1px 4px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor:
                        conf.type === 'agree' ? 'var(--status-running)' :
                        conf.type === 'disagree' ? 'var(--status-stopped)' : 'var(--status-warning)',
                      color: 'white',
                      fontSize: '9px',
                    }}
                  >
                    {conf.type === 'agree' ? '赞同' : conf.type === 'disagree' ? '反对' : '建议'}
                  </span>
                  {conf.comment && (
                    <span style={{ color: 'var(--text-secondary)' }}>: {conf.comment}</span>
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