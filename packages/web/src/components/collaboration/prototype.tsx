'use client';

import { useState } from 'react';

// 类型定义
type CardType = 'brainstorming' | 'writing_plans' | 'development' | 'test' | 'archive';
type CardStatus = 'pending' | 'running' | 'completed' | 'paused' | 'failed';

interface Card {
  id: string;
  cardType: CardType;
  cardStatus: CardStatus;
  title: string;
  summary: string;
  result: string;
  parentCardId: string | null;
  userName: string;
  createdAt: string;
}

interface Message {
  id: number;
  userName: string;
  content: string;
  messageType: 'text' | 'ai_command' | 'document_card';
  cardId?: string;
  createdAt: string;
}

// 模拟数据
const mockCards: Card[] = [
  {
    id: 'card-1',
    cardType: 'brainstorming',
    cardStatus: 'completed',
    title: 'Brainstorming - 登录功能方案设计',
    summary: '支持手机号和微信登录，需考虑 session 兼容性',
    result: `## 登录功能方案

### 1. 登录方式
- **手机号登录**：短信验证码
- **微信登录**：OAuth 授权

### 2. 技术方案
\`\`\`typescript
interface LoginOptions {
  method: 'phone' | 'wechat';
  phone?: string;
  code?: string;
}
\`\`\`

### 3. 兼容性考虑
老项目使用 session 存储登录状态，需要保持不变。`,
    parentCardId: null,
    userName: '产品张三',
    createdAt: '2026-04-20T10:30:00Z',
  },
  {
    id: 'card-2',
    cardType: 'brainstorming',
    cardStatus: 'completed',
    title: 'Brainstorming - 登录功能方案 v2',
    summary: '调整 session 兼容方案',
    result: `## 登录功能方案 (修订版)

Session 保留，JWT 仅用于 API 认证。此方案已与研发团队确认可行。`,
    parentCardId: 'card-1',
    userName: '研发李四',
    createdAt: '2026-04-20T11:00:00Z',
  },
  {
    id: 'card-3',
    cardType: 'writing_plans',
    cardStatus: 'completed',
    title: '实现计划 - 登录功能开发步骤',
    summary: '包含 4 个任务，预估 11 小时',
    result: `## 实现计划

### Task 1: 创建登录页面组件
创建 \`LoginPage.tsx\`

### Task 2: 实现手机号登录
后端 API: \`POST /api/auth/login/phone\`

### Task 3: 实现微信 OAuth
配置微信开放平台应用

### Task 4: Session 兼容处理
登录成功后写入 session

**预估时间**: 11h`,
    parentCardId: 'card-2',
    userName: '研发李四',
    createdAt: '2026-04-20T11:30:00Z',
  },
];

const mockMessages: Message[] = [
  { id: 1, userName: '产品张三', content: '想做一个登录功能', messageType: 'text', createdAt: '2026-04-20T10:00:00Z' },
  { id: 2, userName: '研发李四', content: '需要考虑 session 兼容', messageType: 'text', createdAt: '2026-04-20T10:10:00Z' },
  { id: 3, userName: '产品张三', content: '@AI /superpowers:brainstorming 登录功能', messageType: 'ai_command', createdAt: '2026-04-20T10:20:00Z' },
  { id: 4, userName: 'AI', content: '', messageType: 'document_card', cardId: 'card-1', createdAt: '2026-04-20T10:30:00Z' },
  { id: 5, userName: '研发李四', content: '方案 session 兼容有问题', messageType: 'text', createdAt: '2026-04-20T10:40:00Z' },
  { id: 6, userName: 'AI', content: '', messageType: 'document_card', cardId: 'card-2', createdAt: '2026-04-20T11:00:00Z' },
  { id: 7, userName: '产品张三', content: '方案 v2 可以', messageType: 'text', createdAt: '2026-04-20T11:05:00Z' },
  { id: 8, userName: '研发李四', content: '@AI /superpowers:writing-plans', messageType: 'ai_command', createdAt: '2026-04-20T11:20:00Z' },
  { id: 9, userName: 'AI', content: '', messageType: 'document_card', cardId: 'card-3', createdAt: '2026-04-20T11:30:00Z' },
];

// 语义化色彩（使用 CSS 变量）
const colors = {
  bg: {
    primary: 'var(--bg-primary)',
    card: 'var(--bg-card)',
    hover: 'var(--bg-hover)',
  },
  accent: {
    primary: 'var(--accent-primary)',
    success: 'var(--status-running)',
    warning: 'var(--status-warning)',
    error: 'var(--status-stopped)',
  },
  status: {
    running: 'var(--status-running)',
    warning: 'var(--status-warning)',
    stopped: 'var(--status-stopped)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
  },
  border: {
    default: 'var(--border-default)',
    light: 'var(--border-light)',
  },
  cardType: {
    brainstorming: 'var(--accent-primary)',
    writing_plans: 'var(--bg-active)',
    development: 'var(--status-running)',
    free_chat: 'var(--accent-light)',
    test: 'var(--status-warning)',
    archive: 'var(--text-muted)',
  },
};

const STATUS_COLORS: Record<CardStatus, string> = {
  pending: colors.accent.primary,
  running: colors.accent.success,
  completed: colors.accent.success,
  paused: colors.accent.warning,
  failed: colors.accent.error,
};

const STATUS_LABELS: Record<CardStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  paused: '已中断',
  failed: '失败',
};

const CARD_TYPE_COLORS = colors.cardType;

const CARD_TYPE_LABELS: Record<CardType, string> = {
  brainstorming: '头脑风暴',
  writing_plans: '实现计划',
  development: '开发执行',
  test: '测试',
  archive: '归档',
};

// Markdown 渲染
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div style={{ fontSize: '14px', lineHeight: '1.6', color: colors.text.primary }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px', marginBottom: '8px', color: colors.text.primary }}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: '14px', fontWeight: 600, marginTop: '12px', marginBottom: '6px', color: colors.text.primary }}>{line.slice(4)}</h3>;
        if (line.startsWith('- ')) return <div key={i} style={{ marginLeft: '16px', marginBottom: '4px', color: colors.text.secondary }}>• {line.slice(2)}</div>;
        if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 600, marginBottom: '4px' }}>{line.slice(2, -2)}</div>;
        if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
        return <div key={i} style={{ marginBottom: '4px', color: colors.text.secondary }}>{line}</div>;
      })}
    </div>
  );
}

export function CollaborationPrototype() {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ card: Card; x: number; y: number } | null>(null);

  const getCard = (cardId: string) => mockCards.find(c => c.id === cardId);

  const handleRightClick = (e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    setContextMenu({ card, x: e.clientX, y: e.clientY });
  };

  const handleReference = (card: Card) => {
    setInputValue(`@卡片${card.id} `);
    setContextMenu(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: '14px', background: colors.bg.primary, color: colors.text.primary }}>
      {/* 左侧 - Draft 列表 */}
      <div style={{ width: '240px', borderRight: `1px solid ${colors.border.default}`, background: colors.bg.card, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border.light}`, fontWeight: 600, fontSize: '16px', color: colors.text.primary }}>
          Draft 列表
        </div>

        {/* 新建 Draft 按钮 */}
        <div style={{ padding: '12px 16px' }}>
          <button style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            background: colors.accent.primary,
            color: 'var(--accent-foreground)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            + 新建 Draft
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
          {/* 当前 Draft */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: colors.bg.hover,
            marginBottom: '8px',
            cursor: 'pointer',
            borderLeft: `3px solid ${colors.accent.primary}`,
          }}>
            <div style={{ fontWeight: 500, marginBottom: '6px', fontSize: '14px' }}>登录功能需求讨论</div>
            <div style={{ fontSize: '12px', color: colors.text.muted, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', background: colors.cardType.writing_plans, color: 'var(--accent-foreground)', fontSize: '11px' }}>实现计划</span>
              <span>3 个卡片</span>
            </div>
            <div style={{ fontSize: '11px', color: colors.text.muted, marginTop: '4px' }}>更新于 5 分钟前</div>
          </div>

          {/* 其他 Draft */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: colors.bg.card,
            marginBottom: '8px',
            cursor: 'pointer',
            border: `1px solid ${colors.border.default}`,
          }}>
            <div style={{ fontWeight: 500, marginBottom: '6px', fontSize: '14px' }}>用户注册流程</div>
            <div style={{ fontSize: '12px', color: colors.text.muted, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', background: colors.cardType.brainstorming, color: 'var(--accent-foreground)', fontSize: '11px' }}>头脑风暴</span>
              <span>1 个卡片</span>
            </div>
          </div>

          {/* 已归档 */}
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: colors.bg.card, border: `1px solid ${colors.border.default}`, opacity: 0.7 }}>
            <div style={{ fontWeight: 500, color: colors.text.muted, fontSize: '13px', marginBottom: '4px' }}>📦 已归档 (2)</div>
            <div style={{ fontSize: '12px', color: colors.text.muted }}>支付功能、搜索优化</div>
          </div>
        </div>
      </div>

      {/* 中间 - 聊天区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.bg.primary }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border.default}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: colors.bg.card,
        }}>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>登录功能需求讨论</span>
          <span style={{
            padding: '4px 12px',
            borderRadius: '4px',
            background: colors.cardType.writing_plans,
            color: 'var(--accent-foreground)',
            fontSize: '12px',
            fontWeight: 500,
          }}>
            实现计划
          </span>
          <div style={{ marginLeft: 'auto', fontSize: '12px', color: colors.text.muted }}>
            产品张三、研发李四、测试王五
          </div>
        </div>

        {/* 消息列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {mockMessages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: '16px' }}>
              {msg.messageType === 'text' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {/* 头像 */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    background: colors.bg.hover,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    color: colors.text.secondary,
                    fontWeight: 500,
                  }}>
                    {msg.userName.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px', color: colors.text.primary }}>{msg.userName}</span>
                      <span style={{ fontSize: '12px', color: colors.text.muted }}>
                        {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: colors.text.secondary, lineHeight: '1.5' }}>{msg.content}</div>
                  </div>
                </div>
              )}

              {msg.messageType === 'ai_command' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    background: colors.accent.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: 'var(--accent-foreground)',
                    fontWeight: 600,
                  }}>
                    AI
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px', color: colors.accent.primary }}>{msg.userName}</span>
                    </div>
                    <div style={{
                      padding: '10px 14px',
                      background: colors.bg.card,
                      borderRadius: '8px',
                      borderLeft: `3px solid ${colors.accent.primary}`,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px',
                      color: colors.text.primary,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )}

              {msg.messageType === 'document_card' && msg.cardId && (() => {
                const card = getCard(msg.cardId);
                if (!card) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '4px',
                      background: colors.cardType[card.cardType],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'var(--accent-foreground)',
                      fontWeight: 600,
                    }}>
                      {CARD_TYPE_LABELS[card.cardType].charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '6px', fontSize: '12px', color: colors.text.muted }}>
                        {card.userName} 生成了一个文档卡片
                      </div>
                      <div
                        style={{
                          background: colors.bg.card,
                          border: `1px solid ${colors.border.default}`,
                          borderRadius: '8px',
                          padding: '14px 16px',
                          cursor: 'pointer',
                          maxWidth: '400px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                        onClick={() => setSelectedCard(card)}
                        onContextMenu={(e) => handleRightClick(e, card)}
                      >
                        {/* 卡片头部 */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: STATUS_COLORS[card.cardStatus],
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 500,
                              fontSize: '14px',
                              lineHeight: '1.4',
                              wordBreak: 'break-word',
                              color: colors.text.primary,
                            }}>
                              {card.title}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.text.muted, marginTop: '4px', display: 'flex', gap: '8px' }}>
                              <span style={{ color: colors.cardType[card.cardType] }}>{CARD_TYPE_LABELS[card.cardType]}</span>
                              <span>{STATUS_LABELS[card.cardStatus]}</span>
                            </div>
                          </div>
                        </div>

                        {/* 卡片摘要 */}
                        <div style={{
                          fontSize: '13px',
                          color: colors.text.secondary,
                          padding: '10px 12px',
                          background: colors.bg.primary,
                          borderRadius: '4px',
                          lineHeight: '1.5',
                        }}>
                          {card.summary}
                        </div>

                        {/* 引用标记 */}
                        {card.parentCardId && (
                          <div style={{ fontSize: '12px', color: colors.accent.primary, marginTop: '8px' }}>
                            ↑ 引用自 @{card.parentCardId}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>

        {/* 输入区 */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${colors.border.default}`,
          background: colors.bg.card,
        }}>
          {/* 引用提示 */}
          {inputValue.includes('@卡片') && (
            <div style={{
              marginBottom: '8px',
              padding: '8px 12px',
              background: colors.bg.primary,
              borderRadius: '4px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              borderLeft: `3px solid ${colors.accent.primary}`,
            }}>
              <span style={{ color: colors.accent.primary, fontWeight: 500 }}>引用:</span>
              {(() => {
                const match = inputValue.match(/@卡片([a-z0-9-]+)/);
                if (match) {
                  const card = getCard(match[1]);
                  return card ? <span style={{ marginLeft: '8px', color: colors.text.secondary }}>{card.title}</span> : null;
                }
                return null;
              })()}
              <button onClick={() => setInputValue(inputValue.replace(/@卡片[a-z0-9-]+\s?/, ''))} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted }}>✕</button>
            </div>
          )}

          {/* 输入框 */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end',
          }}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入消息，按 Enter 发送..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '4px',
                border: `1px solid ${colors.border.default}`,
                resize: 'none',
                height: '40px',
                outline: 'none',
                background: colors.bg.primary,
                color: colors.text.primary,
                fontSize: '14px',
                lineHeight: '1.4',
              }}
            />
            <button style={{
              padding: '10px 20px',
              borderRadius: '4px',
              background: colors.accent.primary,
              color: 'var(--accent-foreground)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}>
              发送
            </button>
          </div>

          {/* 快捷按钮 */}
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button style={{
              padding: '4px 12px',
              borderRadius: '4px',
              background: colors.bg.primary,
              color: colors.text.secondary,
              border: `1px solid ${colors.border.default}`,
              cursor: 'pointer',
              fontSize: '13px',
            }}>
              @AI brainstorming
            </button>
            <button style={{
              padding: '4px 12px',
              borderRadius: '4px',
              background: colors.bg.primary,
              color: colors.text.secondary,
              border: `1px solid ${colors.border.default}`,
              cursor: 'pointer',
              fontSize: '13px',
            }}>
              @AI writing-plans
            </button>
          </div>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setContextMenu(null)} />
          <div style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: colors.bg.card,
            border: `1px solid ${colors.border.default}`,
            borderRadius: '8px',
            padding: '8px 0',
            zIndex: 200,
            minWidth: '140px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}>
            <div onClick={() => handleReference(contextMenu.card)} style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: colors.text.primary,
              background: 'transparent',
            }}>
              📋 引用此卡片
            </div>
            <div onClick={() => { setSelectedCard(contextMenu.card); setContextMenu(null); }} style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: colors.text.primary,
              background: 'transparent',
            }}>
              👁 查看详情
            </div>
          </div>
        </>
      )}

      {/* 卡片详情弹窗 */}
      {selectedCard && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }} onClick={() => setSelectedCard(null)}>
          <div style={{
            background: colors.bg.card,
            borderRadius: '12px',
            width: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${colors.border.default}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: STATUS_COLORS[selectedCard.cardStatus],
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: '16px',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    color: colors.text.primary,
                  }}>
                    {selectedCard.title}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: colors.text.muted,
                    marginTop: '6px',
                    display: 'flex',
                    gap: '12px',
                  }}>
                    <span style={{ color: colors.cardType[selectedCard.cardType] }}>{CARD_TYPE_LABELS[selectedCard.cardType]}</span>
                    <span>{selectedCard.userName}</span>
                    <span>{new Date(selectedCard.createdAt).toLocaleString('zh-CN')}</span>
                    {selectedCard.parentCardId && (
                      <span style={{ color: colors.accent.primary }}>↑ @{selectedCard.parentCardId}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedCard(null)} style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: colors.text.muted,
                  padding: '4px',
                }}>✕</button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px', background: colors.bg.primary }}>
              <MarkdownRenderer content={selectedCard.result} />
            </div>

            {/* Actions */}
            <div style={{
              padding: '16px 20px',
              borderTop: `1px solid ${colors.border.default}`,
              display: 'flex',
              gap: '10px',
              background: colors.bg.card,
            }}>
              {selectedCard.cardStatus === 'completed' && (
                <>
                  {selectedCard.cardType === 'writing_plans' ? (
                    <button style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      background: colors.accent.success,
                      color: 'var(--accent-foreground)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}>
                      开始编码
                    </button>
                  ) : (
                    <button style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      background: colors.accent.primary,
                      color: 'var(--accent-foreground)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}>
                      确认继续
                    </button>
                  )}
                  <button onClick={() => handleReference(selectedCard)} style={{
                    padding: '10px 20px',
                    borderRadius: '4px',
                    background: colors.bg.primary,
                    color: colors.text.secondary,
                    border: `1px solid ${colors.border.default}`,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}>
                    引用迭代
                  </button>
                </>
              )}

              {selectedCard.cardStatus === 'paused' && (
                <>
                  <button onClick={() => handleReference(selectedCard)} style={{
                    padding: '10px 20px',
                    borderRadius: '4px',
                    background: colors.accent.success,
                    color: 'var(--accent-foreground)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}>
                    继续执行
                  </button>
                  <button style={{
                    padding: '10px 20px',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: colors.accent.error,
                    border: `1px solid ${colors.accent.error}`,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}>
                    放弃
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollaborationPrototype;