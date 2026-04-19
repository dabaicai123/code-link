# 多人协作模块实现计划（Phase 4: @AI 指令集成）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 @AI 指令功能，允许用户在协作讨论中通过 @AI 触发 AI 助手的代码生成、分析、建议等操作。

**Architecture:** 扩展 Draft 消息系统，添加 AI 指令解析和执行；集成 Claude API 实现智能响应；将响应结果作为系统消息返回到 Draft。

**Tech Stack:** Claude API, Express, TypeScript, WebSocket

---

## 文件结构

```
packages/server/
├── src/
│   ├── ai/
│   │   ├── client.ts              # 新增：Claude API 客户端
│   │   ├── commands.ts            # 新增：AI 指令解析和执行
│   │   ├── prompts.ts             # 新增：AI Prompt 模板
│   │   └── context.ts             # 新增：上下文收集
│   ├── routes/
│   │   └── drafts.ts              # 修改：添加 AI 指令处理
│   └── websocket/
│       └── types.ts               # 修改：添加 AI 响应消息类型
└── tests/
    └── ai-commands.test.ts        # 新增：AI 指令测试

packages/web/
└── src/
    └── components/
    │   └── collaboration/
    │   └── message-item.tsx       # 修改：增强 AI 消息显示
    └── lib/
        └── ai-commands.ts         # 新增：AI 指令前端辅助
```

---

## Task 1: 创建 Claude API 客户端

**Files:**
- Create: `packages/server/src/ai/client.ts`

- [ ] **Step 1: 安装 Anthropic SDK**

```bash
cd /root/my/code-link/packages/server && npm install @anthropic-ai/sdk
```

- [ ] **Step 2: 创建 Claude API 客户端**

```typescript
// packages/server/src/ai/client.ts
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../logger/index.js';

const logger = createLogger('ai-client');

export interface AIResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

let anthropicClient: Anthropic | null = null;

export function initAIClient(apiKey?: string): void {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    logger.warn('ANTHROPIC_API_KEY not set. AI commands disabled.');
    return;
  }

  anthropicClient = new Anthropic({ apiKey: key });
  logger.info('AI client initialized');
}

export function getAIClient(): Anthropic | null {
  return anthropicClient;
}

export async function sendAIMessage(
  messages: AIMessage[],
  options: AIRequestOptions = {}
): Promise<AIResponse> {
  if (!anthropicClient) {
    throw new Error('AI client not initialized');
  }

  const { system, maxTokens = 4096, temperature = 0.7 } = options;

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    // 提取文本内容
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content: textContent,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    logger.error('AI request failed:', error);
    throw error;
  }
}

export function isAIEnabled(): boolean {
  return anthropicClient !== null;
}
```

- [ ] **Step 3: 在 server 启动时初始化**

修改 `packages/server/src/index.ts`，添加 AI 客户端初始化：

```typescript
// 在导入部分添加
import { initAIClient } from './ai/client.js';

// 在启动入口部分添加（在 setEncryptionKey 之后）
import { initAIClient } from './ai/client.js';

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getDb();
  initSchema(db);

  // 设置加密密钥
  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  // 初始化 AI 客户端
  initAIClient();

  startServer(db, process.env.PORT ? parseInt(process.env.PORT) : 4000);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/ai/client.ts packages/server/src/index.ts packages/server/package.json
git commit -m "$(cat <<'EOF'
feat(server): add Claude API client for AI commands

Add Anthropic SDK client with message sending support
and initialization on server startup.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 AI 指令解析器

**Files:**
- Create: `packages/server/src/ai/commands.ts`

- [ ] **Step 1: 创建指令解析和执行模块**

```typescript
// packages/server/src/ai/commands.ts
import type Database from 'better-sqlite3';
import { sendAIMessage, isAIEnabled, type AIMessage } from './client.js';
import { buildContextForDraft, type DraftContext } from './context.js';
import { getSystemPrompt, getCommandPrompt } from './prompts.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('ai-commands');

export type AICommandType =
  | 'generate'
  | 'analyze'
  | 'suggest'
  | 'explain'
  | 'review'
  | 'refactor'
  | 'test';

export interface AICommand {
  type: AICommandType;
  target?: string;
  params?: Record<string, string>;
  rawContent: string;
}

export interface AICommandResult {
  success: boolean;
  response?: string;
  commandType: AICommandType;
  error?: string;
}

const COMMAND_PATTERNS: Record<AICommandType, RegExp> = {
  generate: /@AI\s+generate\s+(.+)/i,
  analyze: /@AI\s+analyze\s+(.+)/i,
  suggest: /@AI\s+suggest\s+(.+)/i,
  explain: /@AI\s+explain\s+(.+)/i,
  review: /@AI\s+review\s+(.+)/i,
  refactor: /@AI\s+refactor\s+(.+)/i,
  test: /@AI\s+test\s+(.+)/i,
};

/**
 * 解析 AI 指令
 */
export function parseAICommand(content: string): AICommand | null {
  for (const [type, pattern] of Object.entries(COMMAND_PATTERNS)) {
    const match = content.match(pattern);
    if (match) {
      const target = match[1].trim();
      // 解析额外参数（如 --file, --language 等）
      const params: Record<string, string> = {};
      const paramPattern = /--(\w+)\s+(\S+)/g;
      let paramMatch;
      while ((paramMatch = paramPattern.exec(target)) !== null) {
        params[paramMatch[1]] = paramMatch[2];
      }
      // 移除参数部分，保留核心目标
      const cleanTarget = target.replace(paramPattern, '').trim();

      return {
        type: type as AICommandType,
        target: cleanTarget,
        params,
        rawContent: content,
      };
    }
  }

  return null;
}

/**
 * 执行 AI 指令
 */
export async function executeAICommand(
  db: Database.Database,
  draftId: number,
  command: AICommand,
  userId: number
): Promise<AICommandResult> {
  if (!isAIEnabled()) {
    return {
      success: false,
      commandType: command.type,
      error: 'AI 功能未启用。请配置 ANTHROPIC_API_KEY。',
    };
  }

  try {
    // 收集上下文
    const context = await buildContextForDraft(db, draftId);

    // 构建消息
    const messages: AIMessage[] = [
      {
        role: 'user',
        content: getCommandPrompt(command, context),
      },
    ];

    // 发送请求
    const response = await sendAIMessage(messages, {
      system: getSystemPrompt(command.type, context),
      maxTokens: 4096,
      temperature: 0.7,
    });

    logger.info(`AI command executed: ${command.type}`, {
      draftId,
      userId,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    });

    return {
      success: true,
      response: response.content,
      commandType: command.type,
    };
  } catch (error) {
    logger.error('Failed to execute AI command:', error);
    return {
      success: false,
      commandType: command.type,
      error: error instanceof Error ? error.message : '执行失败',
    };
  }
}

/**
 * 检查内容是否是 AI 指令
 */
export function isAICommand(content: string): boolean {
  return content.trim().startsWith('@AI');
}

/**
 * 获取支持的指令类型列表
 */
export function getSupportedCommands(): Array<{ type: AICommandType; description: string; example: string }> {
  return [
    { type: 'generate', description: '生成代码', example: '@AI generate a function to sort array' },
    { type: 'analyze', description: '分析代码或问题', example: '@AI analyze the performance issues' },
    { type: 'suggest', description: '提供建议', example: '@AI suggest improvements for this code' },
    { type: 'explain', description: '解释代码或概念', example: '@AI explain how React hooks work' },
    { type: 'review', description: '代码评审', example: '@AI review the changes in file.ts' },
    { type: 'refactor', description: '重构建议', example: '@AI refactor this function' },
    { type: 'test', description: '生成测试', example: '@AI test cases for this component' },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/ai/commands.ts
git commit -m "$(cat <<'EOF'
feat(server): add AI command parser and executor

Add command parsing with pattern matching, execution
with context building, and supported command list.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 创建上下文收集模块

**Files:**
- Create: `packages/server/src/ai/context.ts`

- [ ] **Step 1: 创建上下文收集模块**

```typescript
// packages/server/src/ai/context.ts
import type Database from 'better-sqlite3';
import { createLogger } from '../logger/index.js';

const logger = createLogger('ai-context');

export interface DraftContext {
  draftId: number;
  projectId: number;
  project: {
    name: string;
    templateType: string;
  };
  draft: {
    title: string;
    status: string;
  };
  recentMessages: Array<{
    userId: number;
    userName: string;
    content: string;
    messageType: string;
    createdAt: string;
  }>;
  members: Array<{
    userId: number;
    userName: string;
    role: string;
  }>;
  container?: {
    id: string;
    status: string;
  };
}

/**
 * 为 Draft 构建 AI 上下文
 */
export async function buildContextForDraft(
  db: Database.Database,
  draftId: number
): Promise<DraftContext> {
  // 获取 Draft 信息
  const draft = db.prepare(`
    SELECT d.*, p.name as project_name, p.template_type as project_template
    FROM drafts d
    JOIN projects p ON d.project_id = p.id
    WHERE d.id = ?
  `).get(draftId) as any;

  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  // 获取最近的消息（最多 20 条）
  const recentMessages = db.prepare(`
    SELECT m.*, u.name as user_name
    FROM draft_messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.draft_id = ?
    ORDER BY m.created_at DESC
    LIMIT 20
  `).all(draftId) as any[];

  // 获取成员列表
  const members = db.prepare(`
    SELECT dm.*, u.name as user_name
    FROM draft_members dm
    JOIN users u ON dm.user_id = u.id
    WHERE dm.draft_id = ?
  `).all(draftId) as any[];

  // 获取容器信息（如果存在）
  const container = db.prepare(`
    SELECT c.id, c.status
    FROM containers c
    WHERE c.project_id = ?
    ORDER BY c.created_at DESC
    LIMIT 1
  `).get(draft.project_id) as any;

  // 格式化消息（反转顺序，从早到晚）
  const formattedMessages = recentMessages
    .reverse()
    .map(m => ({
      userId: m.user_id,
      userName: m.user_name,
      content: m.content,
      messageType: m.message_type,
      createdAt: m.created_at,
    }));

  return {
    draftId,
    projectId: draft.project_id,
    project: {
      name: draft.project_name,
      templateType: draft.project_template,
    },
    draft: {
      title: draft.title,
      status: draft.status,
    },
    recentMessages: formattedMessages,
    members: members.map(m => ({
      userId: m.user_id,
      userName: m.user_name,
      role: m.role,
    })),
    container: container ? { id: container.id, status: container.status } : undefined,
  };
}

/**
 * 格式化上下文为文本（用于 Prompt）
 */
export function formatContextAsText(context: DraftContext): string {
  const lines: string[] = [];

  lines.push(`# 项目信息`);
  lines.push(`- 项目名称: ${context.project.name}`);
  lines.push(`- 项目类型: ${context.project.templateType}`);

  lines.push(`\n# Draft 信息`);
  lines.push(`- Draft 标题: ${context.draft.title}`);
  lines.push(`- 当前状态: ${context.draft.status}`);

  lines.push(`\n# 成员`);
  context.members.forEach(m => {
    lines.push(`- ${m.userName} (${m.role})`);
  });

  if (context.recentMessages.length > 0) {
    lines.push(`\n# 最近讨论（共 ${context.recentMessages.length} 条）`);
    context.recentMessages.forEach(m => {
      const typeLabel = m.messageType === 'ai_command' ? '[AI指令]' :
                        m.messageType === 'code' ? '[代码]' : '';
      lines.push(`- ${m.userName}: ${typeLabel} ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`);
    });
  }

  if (context.container) {
    lines.push(`\n# 容器状态`);
    lines.push(`- 容器 ID: ${context.container.id}`);
    lines.push(`- 状态: ${context.container.status}`);
  }

  return lines.join('\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/ai/context.ts
git commit -m "$(cat <<'EOF'
feat(server): add AI context builder for drafts

Add context collection including project info, recent messages,
members, and container status with text formatting.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 创建 AI Prompt 模板

**Files:**
- Create: `packages/server/src/ai/prompts.ts`

- [ ] **Step 1: 创建 Prompt 模板**

```typescript
// packages/server/src/ai/prompts.ts
import type { AICommandType, AICommand } from './commands.js';
import type { DraftContext } from './context.js';
import { formatContextAsText } from './context.js';

const SYSTEM_PROMPTS: Record<AICommandType, string> = {
  generate: `你是一个专业的代码生成助手。你需要根据用户的请求生成代码。

规则：
1. 生成干净、可读、符合最佳实践的代码
2. 包含必要的注释解释关键部分
3. 如果用户没有指定语言，根据项目类型推断
4. 提供完整可运行的代码，而不是片段
5. 如果需要，提供使用示例

输出格式：
- 首先简要说明生成的内容
- 然后提供代码（使用代码块）
- 最后提供使用建议`,

  analyze: `你是一个代码分析专家。你需要深入分析用户提出的问题或代码。

规则：
1. 进行全面分析，考虑性能、安全性、可维护性等方面
2. 指出潜在问题和风险
3. 提供具体的数据和证据支持分析结论
4. 使用结构化的方式呈现分析结果

输出格式：
## 概述
简要说明分析对象

## 发现的问题
列出发现的具体问题

## 详细分析
针对每个问题进行深入分析

## 建议改进
提供改进建议`,

  suggest: `你是一个技术顾问。你需要根据当前情况提供专业的建议。

规则：
1. 考虑多种可能的方案
2. 对比各方案的优劣
3. 给出推荐的最佳方案
4. 说明推荐的理由

输出格式：
## 可选方案
列出可能的方案

## 方案对比
对比各方案的优劣

## 推荐方案
推荐最佳方案并说明理由`,

  explain: `你是一个技术讲解者。你需要清晰地解释技术概念或代码逻辑。

规则：
1. 使用通俗易懂的语言
2. 从基础概念开始，逐步深入
3. 使用类比和示例帮助理解
4. 避免过于专业的术语，或解释术语含义

输出格式：
## 简介
简要说明要解释的内容

## 基础概念
解释相关的基础概念

## 详细说明
详细解释核心内容

## 示例
提供具体示例`,

  review: `你是一个代码评审专家。你需要评审代码变更并提供反馈。

规则：
1. 检查代码质量、风格、最佳实践
2. 指出潜在 bug 和安全问题
3. 建议改进点
4. 使用专业的评审语言

输出格式：
## 总体评价
简要评价代码质量

## 发现的问题
按严重程度分类列出问题

## 具体反馈
逐条说明问题和建议

## 改进建议
总结改进建议`,

  refactor: `你是一个重构专家。你需要提供代码重构建议和重构后的代码。

规则：
1. 保持原有功能不变
2. 提高代码的可读性、可维护性
3. 应用设计模式和最佳实践
4. 说明重构的理由

输出格式：
## 重构目标
说明本次重构的目标

## 重构策略
说明采用的策略

## 重构后的代码
提供重构后的完整代码

## 变化说明
说明主要的变化和理由`,

  test: `你是一个测试专家。你需要为代码生成测试方案和测试代码。

规则：
1. 覆盖正常场景和边界场景
2. 考虑错误处理测试
3. 使用清晰的测试描述
4. 提供可执行的测试代码

输出格式：
## 测试策略
说明测试覆盖策略

## 测试场景
列出主要测试场景

## 测试代码
提供完整的测试代码`,
};

/**
 * 获取系统 Prompt
 */
export function getSystemPrompt(commandType: AICommandType, context: DraftContext): string {
  const basePrompt = SYSTEM_PROMPTS[commandType];
  const contextText = formatContextAsText(context);

  return `${basePrompt}

---
以下是当前的协作上下文：

${contextText}`;
}

/**
 * 获取用户指令 Prompt
 */
export function getCommandPrompt(command: AICommand, context: DraftContext): string {
  const contextText = formatContextAsText(context);

  let prompt = `请执行以下指令：\n${command.rawContent}`;

  if (command.target) {
    prompt += `\n\n目标: ${command.target}`;
  }

  if (command.params && Object.keys(command.params).length > 0) {
    prompt += `\n\n参数:`;
    Object.entries(command.params).forEach(([key, value]) => {
      prompt += `\n- ${key}: ${value}`;
    });
  }

  // 如果上下文中有相关讨论，添加引用
  const relevantMessages = context.recentMessages
    .filter(m => m.messageType !== 'system' && m.content.length > 20)
    .slice(-5);

  if (relevantMessages.length > 0) {
    prompt += `\n\n相关讨论:`;
    relevantMessages.forEach(m => {
      prompt += `\n- ${m.userName}: "${m.content.slice(0, 80)}..."`;
    });
  }

  return prompt;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/ai/prompts.ts
git commit -m "$(cat <<'EOF'
feat(server): add AI prompt templates for each command type

Add comprehensive system prompts and command-specific
user prompts with context integration.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 集成 AI 指令到 Draft 路由

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`

- [ ] **Step 1: 在消息发送路由中添加 AI 指令处理**

在 `packages/server/src/routes/drafts.ts` 中添加 AI 指令处理逻辑：

首先添加导入：

```typescript
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { getWebSocketServer } from '../websocket/server.js';
import {
  createDraftMessageEvent,
  createDraftMemberJoinedEvent,
  createDraftStatusChangedEvent,
  createDraftMessageConfirmedEvent,
} from '../websocket/types.js';
import {
  isAICommand,
  parseAICommand,
  executeAICommand,
} from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';
import type {
  Draft,
  DraftMember,
  DraftStatus,
  CreateDraftInput,
  UpdateDraftInput
} from '../types/draft.js';
```

修改发送消息的路由：

```typescript
  // 发送消息
  router.post('/:draftId/messages', async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { content, messageType, parentId, metadata } = req.body;

    if (isNaN(draftId) || !content) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      // 检查用户是否是 Draft 成员
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      // 确定消息类型
      let actualMessageType = messageType || 'text';
      if (isAICommand(content)) {
        actualMessageType = 'ai_command';
      }

      // 保存用户消息
      const result = db.prepare(`
        INSERT INTO draft_messages (draft_id, parent_id, user_id, content, message_type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        draftId,
        parentId || null,
        userId,
        content,
        actualMessageType,
        metadata ? JSON.stringify(metadata) : null
      );

      const messageId = result.lastInsertRowid as number;

      // 更新 draft 的 updated_at
      db.prepare(`UPDATE drafts SET updated_at = datetime('now') WHERE id = ?`).run(draftId);

      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string };

      const message = db.prepare(`
        SELECT m.*, u.name as user_name
        FROM draft_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `).get(messageId);

      // WebSocket 广播用户消息
      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageEvent(draftId, message as any);
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      // 如果是 AI 指令，执行并返回响应
      if (actualMessageType === 'ai_command' && isAIEnabled()) {
        const command = parseAICommand(content);
        if (command) {
          // 异步执行 AI 指令
          const aiResult = await executeAICommand(db, draftId, command, userId);

          if (aiResult.success && aiResult.response) {
            // 保存 AI 响应作为系统消息
            const aiResultInsert = db.prepare(`
              INSERT INTO draft_messages (draft_id, parent_id, user_id, content, message_type, metadata)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              draftId,
              messageId, // AI 响应作为用户消息的回复
              userId, // 使用触发者的 ID（AI 没有自己的 ID）
              aiResult.response,
              'system',
              JSON.stringify({
                aiCommandType: command.type,
                model: 'claude-sonnet-4-6',
              })
            );

            const aiMessageId = aiResultInsert.lastInsertRowid as number;

            // 获取 AI 消息（带特殊标记）
            const aiMessage = db.prepare(`
              SELECT m.*, 'AI 助手' as user_name
              FROM draft_messages m
              WHERE m.id = ?
            `).get(aiMessageId);

            // WebSocket 广播 AI 响应
            if (wsServer) {
              const wsAIMessage = createDraftMessageEvent(draftId, {
                ...aiMessage,
                message_type: 'ai_response',
              });
              wsServer.broadcastDraftMessage(draftId, wsAIMessage);
            }
          } else if (aiResult.error) {
            // 保存错误消息
            const errorMsg = `AI 指令执行失败: ${aiResult.error}`;
            db.prepare(`
              INSERT INTO draft_messages (draft_id, parent_id, user_id, content, message_type)
              VALUES (?, ?, ?, ?, ?)
            `).run(draftId, messageId, userId, errorMsg, 'system');

            if (wsServer) {
              const wsError = createDraftMessageEvent(draftId, {
                id: 0,
                draft_id: draftId,
                parent_id: messageId,
                user_id: userId,
                user_name: '系统',
                content: errorMsg,
                message_type: 'system',
                created_at: new Date().toISOString(),
              });
              wsServer.broadcastDraftMessage(draftId, wsError);
            }
          }
        }
      }

      res.status(201).json({ message });
    } catch (error) {
      console.error('Failed to send message:', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/routes/drafts.ts
git commit -m "$(cat <<'EOF'
feat(server): integrate AI command execution in draft messages

Add AI command detection, execution, and response
broadcast when users send @AI messages.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 扩展 WebSocket 消息类型支持 AI 响应

**Files:**
- Modify: `packages/server/src/websocket/types.ts`

- [ ] **Step 1: 添加 AI 响应消息类型**

在 `packages/server/src/websocket/types.ts` 中添加：

```typescript
// 在 DraftMessageType 类型中添加
export type DraftMessageType =
  | 'draft_message'
  | 'draft_member_joined'
  | 'draft_member_left'
  | 'draft_status_changed'
  | 'draft_message_confirmed'
  | 'draft_ai_response';  // 新增

// 在 DraftBaseMessage 后添加新接口
export interface DraftAIResponseEvent extends DraftBaseMessage {
  type: 'draft_ai_response';
  message: {
    id: number;
    draft_id: number;
    parent_id: number;
    user_id: number;
    user_name: string;
    content: string;
    message_type: string;
    metadata: string | null;
    created_at: string;
  };
  commandType: string;
}

// 更新 DraftMessage 类型
export type DraftMessage =
  | DraftMessageEvent
  | DraftMemberJoinedEvent
  | DraftMemberLeftEvent
  | DraftStatusChangedEvent
  | DraftMessageConfirmedEvent
  | DraftAIResponseEvent;  // 新增
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/websocket/types.ts
git commit -m "$(cat <<'EOF'
feat(server): add draft_ai_response WebSocket message type

Add AI response event type for broadcasting AI
command results to draft members.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 创建 AI 指令测试

**Files:**
- Create: `packages/server/tests/ai-commands.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
// packages/server/tests/ai-commands.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseAICommand, isAICommand, getSupportedCommands } from '../src/ai/commands.js';

describe('AI Commands', () => {
  describe('parseAICommand', () => {
    it('should parse generate command', () => {
      const content = '@AI generate a function to sort array';
      const command = parseAICommand(content);

      expect(command).not.toBeNull();
      expect(command?.type).toBe('generate');
      expect(command?.target).toBe('a function to sort array');
    });

    it('should parse analyze command', () => {
      const content = '@AI analyze the performance issues in this code';
      const command = parseAICommand(content);

      expect(command).not.toBeNull();
      expect(command?.type).toBe('analyze');
      expect(command?.target).toBe('the performance issues in this code');
    });

    it('should parse command with parameters', () => {
      const content = '@AI generate a component --language TypeScript --style CSS';
      const command = parseAICommand(content);

      expect(command).not.toBeNull();
      expect(command?.type).toBe('generate');
      expect(command?.params?.language).toBe('TypeScript');
      expect(command?.params?.style).toBe('CSS');
    });

    it('should return null for invalid command', () => {
      const content = '@AI invalid command type';
      const command = parseAICommand(content);

      expect(command).toBeNull();
    });

    it('should return null for non-AI message', () => {
      const content = 'This is a regular message';
      const command = parseAICommand(content);

      expect(command).toBeNull();
    });
  });

  describe('isAICommand', () => {
    it('should return true for AI command', () => {
      expect(isAICommand('@AI generate something')).toBe(true);
      expect(isAICommand('  @AI analyze code')).toBe(true);
    });

    it('should return false for regular message', () => {
      expect(isAICommand('Hello world')).toBe(false);
      expect(isAICommand('@AI mentions someone')).toBe(false); // Not a command pattern
    });
  });

  describe('getSupportedCommands', () => {
    it('should return all supported commands', () => {
      const commands = getSupportedCommands();

      expect(commands).toHaveLength(7);
      expect(commands.map(c => c.type)).toContain('generate');
      expect(commands.map(c => c.type)).toContain('analyze');
      expect(commands.map(c => c.type)).toContain('suggest');
      expect(commands.map(c => c.type)).toContain('explain');
      expect(commands.map(c => c.type)).toContain('review');
      expect(commands.map(c => c.type)).toContain('refactor');
      expect(commands.map(c => c.type)).toContain('test');
    });

    it('should have description and example for each command', () => {
      const commands = getSupportedCommands();

      commands.forEach(cmd => {
        expect(cmd.description).toBeTruthy();
        expect(cmd.example).toBeTruthy();
        expect(cmd.example.startsWith('@AI')).toBe(true);
      });
    });
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
cd /root/my/code-link/packages/server && npm test -- ai-commands.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/tests/ai-commands.test.ts
git commit -m "$(cat <<'EOF'
test(server): add AI command parser tests

Add tests for command parsing, parameter extraction,
and supported command list validation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 增强前端 AI 消息显示

**Files:**
- Modify: `packages/web/src/components/collaboration/message-item.tsx`

- [ ] **Step 1: 增强 AI 响应消息显示**

修改 `packages/web/src/components/collaboration/message-item.tsx`：

```typescript
// 在 MessageItem 组件中添加对 AI 响应的处理
// 修改 isCode 和 isAICommand 的判断部分

  const isCode = message.message_type === 'code';
  const isAICommand = message.message_type === 'ai_command';
  const isAIResponse = message.message_type === 'ai_response' || 
                       (message.message_type === 'system' && message.user_name === 'AI 助手');
  const isSystem = message.message_type === 'system' && !isAIResponse;

  // 修改头像部分
  const avatarColor = isAICommand || isAIResponse ? 'var(--accent-color)' : 'var(--bg-hover)';
  const avatarText = isAICommand || isAIResponse ? 'AI' : (message.user_name?.[0] || '?').toUpperCase();
  const displayName = isAICommand || isAIResponse ? 'AI 助手' : message.user_name || '未知用户';

  // 在消息内容后添加 AI 响应的元数据显示
  {isAIResponse && message.metadata && (
    <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
      {(() => {
        try {
          const meta = JSON.parse(message.metadata);
          return (
            <span style={{ opacity: 0.7 }}>
              指令类型: {meta.aiCommandType || '未知'} · 模型: {meta.model || 'Claude'}
            </span>
          );
        } catch {
          return null;
        }
      })()}
    </div>
  )}
```

- [ ] **Step 2: 创建前端 AI 指令辅助模块**

```typescript
// packages/web/src/lib/ai-commands.ts
import type { AICommandType } from '../../types/draft';

export interface AICommandSuggestion {
  type: AICommandType;
  description: string;
  example: string;
}

export const AI_COMMANDS: AICommandSuggestion[] = [
  { type: 'generate', description: '生成代码', example: '@AI generate a function to sort array' },
  { type: 'analyze', description: '分析代码或问题', example: '@AI analyze the performance issues' },
  { type: 'suggest', description: '提供改进建议', example: '@AI suggest improvements for this code' },
  { type: 'explain', description: '解释代码或概念', example: '@AI explain how React hooks work' },
  { type: 'review', description: '代码评审', example: '@AI review the changes in file.ts' },
  { type: 'refactor', description: '重构建议', example: '@AI refactor this function' },
  { type: 'test', description: '生成测试', example: '@AI test cases for this component' },
];

export function getAICommandSuggestions(): AICommandSuggestion[] {
  return AI_COMMANDS;
}

export function detectAICommand(input: string): { isAI: boolean; command?: AICommandType } {
  const trimmed = input.trim();
  if (!trimmed.startsWith('@AI')) {
    return { isAI: false };
  }

  for (const cmd of AI_COMMANDS) {
    if (trimmed.match(new RegExp(`@AI\\s+${cmd.type}`, 'i'))) {
      return { isAI: true, command: cmd.type };
    }
  }

  return { isAI: true }; // Is AI but unknown command
}

export function formatAICommand(type: AICommandType, target: string, params?: Record<string, string>): string {
  let command = `@AI ${type} ${target}`;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      command += ` --${key} ${value}`;
    });
  }
  return command;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/collaboration/message-item.tsx packages/web/src/lib/ai-commands.ts
git commit -m "$(cat <<'EOF'
feat(web): enhance AI message display and add command helper

Add AI response styling, metadata display, and frontend
command suggestion/formatting utilities.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 更新前端类型定义

**Files:**
- Modify: `packages/web/src/types/draft.ts`

- [ ] **Step 1: 添加 AI 指令类型**

在 `packages/web/src/types/draft.ts` 中添加：

```typescript
// 在 MessageType 类型中添加
export type MessageType =
  | 'text'
  | 'image'
  | 'code'
  | 'document_card'
  | 'ai_command'
  | 'ai_response'  // 新增
  | 'system';

// 添加 AI 指令类型
export type AICommandType =
  | 'generate'
  | 'analyze'
  | 'suggest'
  | 'explain'
  | 'review'
  | 'refactor'
  | 'test';

export interface AICommandMetadata {
  aiCommandType?: AICommandType;
  model?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/types/draft.ts
git commit -m "$(cat <<'EOF'
feat(web): add AI command types to draft definitions

Add ai_response message type and AICommandType
with metadata interface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成检查

- [ ] AI 客户端正确初始化
- [ ] AI 指令解析正确
- [ ] AI 执行并返回响应
- [ ] WebSocket 广播 AI 响应
- [ ] 前端正确显示 AI 响应
- [ ] 所有测试通过
- [ ] 代码已提交

---

**Phase 4 完成。后续 Phase 将包括：**
- Phase 5: Yjs/Hocuspocus 实时同步