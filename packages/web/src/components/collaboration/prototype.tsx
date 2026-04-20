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

// 钉钉风格色彩（浅色友好）
const colors = {
  bgPrimary: '#f5f5f5',
  bgSecondary: '#fff',
  bgCard: '#fff',
  bgHover: '#e8e8e8',
  bgActive: '#d9d9d9',
  accentPrimary: '#1890ff',
  accentSuccess: '#52c41a',
  accentWarning: '#faad14',
  accentError: '#ff4d4f',
  textPrimary: '#262626',
  textSecondary: '#595959',
  textMuted: '#8c8c8c',
  border: '#d9d9d9',
  borderLight: '#f0f0f0',
};

const STATUS_COLORS: Record<CardStatus, string> = {
  pending: colors.accentPrimary,
  running: colors.accentSuccess,
  completed: colors.accentSuccess,
  paused: colors.accentWarning,
  failed: colors.accentError,
};

const STATUS_LABELS: Record<CardStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  paused: '已中断',
  failed: '失败',
};

const CARD_TYPE_COLORS: Record<CardType, string> = {
  brainstorming: '#1890ff',
  writing_plans: '#722ed1',
  development: '#52c41a',
  test: '#fa8c16',
  archive: '#8c8c8c',
};

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
    <div style={{ fontSize: '14px', lineHeight: '1.6', color: colors.textPrimary }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px', marginBottom: '8px', color: colors.textPrimary }}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: '14px', fontWeight: 600, marginTop: '12px', marginBottom: '6px', color: colors.textPrimary }}>{line.slice(4)}</h3>;
        if (line.startsWith('- ')) return <div key={i} style={{ marginLeft: '16px', marginBottom: '4px', color: colors.textSecondary }}>• {line.slice(2)}</div>;
        if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 600, marginBottom: '4px' }}>{line.slice(2, -2)}</div>;
        if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
        return <div key={i} style={{ marginBottom: '4px', color: colors.textSecondary }}>{line}</div>;
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
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: '14px', background: colors.bgPrimary, color: colors.textPrimary }}>
      {/* 左侧 - Draft 列表 */}
      <div style={{ width: '240px', borderRight: `1px solid ${colors.border}`, background: colors.bgSecondary, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${colors.borderLight}`, fontWeight: 600, fontSize: '16px', color: colors.textPrimary }}>
          Draft 列表
        </div>

        {/* 新建 Draft 按钮 */}
        <div style={{ padding: '12px 16px' }}>
          <button style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            background: colors.accentPrimary,
            color: '#fff',
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
            background: colors.bgHover,
            marginBottom: '8px',
            cursor: 'pointer',
            borderLeft: `3px solid ${colors.accentPrimary}`,
          }}>
            <div style={{ fontWeight: 500, marginBottom: '6px', fontSize: '14px' }}>登录功能需求讨论</div>
            <div style={{ fontSize: '12px', color: colors.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', background: CARD_TYPE_COLORS.writing_plans, color: '#fff', fontSize: '11px' }}>实现计划</span>
              <span>3 个卡片</span>
            </div>
            <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px' }}>更新于 5 分钟前</div>
          </div>

          {/* 其他 Draft */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: colors.bgSecondary,
            marginBottom: '8px',
            cursor: 'pointer',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontWeight: 500, marginBottom: '6px', fontSize: '14px' }}>用户注册流程</div>
            <div style={{ fontSize: '12px', color: colors.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', background: CARD_TYPE_COLORS.brainstorming, color: '#fff', fontSize: '11px' }}>头脑风暴</span>
              <span>1 个卡片</span>
            </div>
          </div>

          {/* 已归档 */}
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, opacity: 0.7 }}>
            <div style={{ fontWeight: 500, color: colors.textMuted, fontSize: '13px', marginBottom: '4px' }}>📦 已归档 (2)</div>
            <div style={{ fontSize: '12px', color: colors.textMuted }}>支付功能、搜索优化</div>
          </div>
        </div>
      </div>

      {/* 中间 - 聊天区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.bgPrimary }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: colors.bgSecondary,
        }}>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>登录功能需求讨论</span>
          <span style={{
            padding: '4px 12px',
            borderRadius: '4px',
            background: CARD_TYPE_COLORS.writing_plans,
            color: '#fff',
            fontSize: '12px',
            fontWeight: 500,
          }}>
            实现计划
          </span>
          <div style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>
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
                    background: colors.bgHover,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    color: colors.textSecondary,
                    fontWeight: 500,
                  }}>
                    {msg.userName.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px', color: colors.textPrimary }}>{msg.userName}</span>
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>
                        {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: '1.5' }}>{msg.content}</div>
                  </div>
                </div>
              )}

              {msg.messageType === 'ai_command' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    background: colors.accentPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    AI
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px', color: colors.accentPrimary }}>{msg.userName}</span>
                    </div>
                    <div style={{
                      padding: '10px 14px',
                      background: colors.bgSecondary,
                      borderRadius: '8px',
                      borderLeft: `3px solid ${colors.accentPrimary}`,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px',
                      color: colors.textPrimary,
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
                      background: CARD_TYPE_COLORS[card.cardType],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: '#fff',
                      fontWeight: 600,
                    }}>
                      {CARD_TYPE_LABELS[card.cardType].charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '6px', fontSize: '12px', color: colors.textMuted }}>
                        {card.userName} 生成了一个文档卡片
                      </div>
                      <div
                        style={{
                          background: colors.bgSecondary,
                          border: `1px solid ${colors.border}`,
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
                              color: colors.textPrimary,
                            }}>
                              {card.title}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '4px', display: 'flex', gap: '8px' }}>
                              <span style={{ color: CARD_TYPE_COLORS[card.cardType] }}>{CARD_TYPE_LABELS[card.cardType]}</span>
                              <span>{STATUS_LABELS[card.cardStatus]}</span>
                            </div>
                          </div>
                        </div>

                        {/* 卡片摘要 */}
                        <div style={{
                          fontSize: '13px',
                          color: colors.textSecondary,
                          padding: '10px 12px',
                          background: colors.bgPrimary,
                          borderRadius: '4px',
                          lineHeight: '1.5',
                        }}>
                          {card.summary}
                        </div>

                        {/* 引用标记 */}
                        {card.parentCardId && (
                          <div style={{ fontSize: '12px', color: colors.accentPrimary, marginTop: '8px' }}>
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
          borderTop: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
        }}>
          {/* 引用提示 */}
          {inputValue.includes('@卡片') && (
            <div style={{
              marginBottom: '8px',
              padding: '8px 12px',
              background: colors.bgPrimary,
              borderRadius: '4px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              borderLeft: `3px solid ${colors.accentPrimary}`,
            }}>
              <span style={{ color: colors.accentPrimary, fontWeight: 500 }}>引用:</span>
              {(() => {
                const match = inputValue.match(/@卡片([a-z0-9-]+)/);
                if (match) {
                  const card = getCard(match[1]);
                  return card ? <span style={{ marginLeft: '8px', color: colors.textSecondary }}>{card.title}</span> : null;
                }
                return null;
              })()}
              <button onClick={() => setInputValue(inputValue.replace(/@卡片[a-z0-9-]+\s?/, ''))} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted }}>✕</button>
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
                border: `1px solid ${colors.border}`,
                resize: 'none',
                height: '40px',
                outline: 'none',
                background: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                lineHeight: '1.4',
              }}
            />
            <button style={{
              padding: '10px 20px',
              borderRadius: '4px',
              background: colors.accentPrimary,
              color: '#fff',
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
              background: colors.bgPrimary,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              fontSize: '13px',
            }}>
              @AI brainstorming
            </button>
            <button style={{
              padding: '4px 12px',
              borderRadius: '4px',
              background: colors.bgPrimary,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
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
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
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
              color: colors.textPrimary,
              background: 'transparent',
            }}>
              📋 引用此卡片
            </div>
            <div onClick={() => { setSelectedCard(contextMenu.card); setContextMenu(null); }} style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: colors.textPrimary,
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
            background: colors.bgSecondary,
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
              borderBottom: `1px solid ${colors.border}`,
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
                    color: colors.textPrimary,
                  }}>
                    {selectedCard.title}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: colors.textMuted,
                    marginTop: '6px',
                    display: 'flex',
                    gap: '12px',
                  }}>
                    <span style={{ color: CARD_TYPE_COLORS[selectedCard.cardType] }}>{CARD_TYPE_LABELS[selectedCard.cardType]}</span>
                    <span>{selectedCard.userName}</span>
                    <span>{new Date(selectedCard.createdAt).toLocaleString('zh-CN')}</span>
                    {selectedCard.parentCardId && (
                      <span style={{ color: colors.accentPrimary }}>↑ @{selectedCard.parentCardId}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedCard(null)} style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: colors.textMuted,
                  padding: '4px',
                }}>✕</button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px', background: colors.bgPrimary }}>
              <MarkdownRenderer content={selectedCard.result} />
            </div>

            {/* Actions */}
            <div style={{
              padding: '16px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              gap: '10px',
              background: colors.bgSecondary,
            }}>
              {selectedCard.cardStatus === 'completed' && (
                <>
                  {selectedCard.cardType === 'writing_plans' ? (
                    <button style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      background: colors.accentSuccess,
                      color: '#fff',
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
                      background: colors.accentPrimary,
                      color: '#fff',
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
                    background: colors.bgPrimary,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
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
                    background: colors.accentSuccess,
                    color: '#fff',
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
                    color: colors.accentError,
                    border: `1px solid ${colors.accentError}`,
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