# 多人协作模块设计文档

## 一、概述

### 目标

在右侧 CollaborationPanel 新增多人实时协作模块，支持设计、产品、研发、测试人员在一个聊天窗口中完成需求沟通、方案讨论、技术评审、归档等全流程协作。

### 核心价值

- 产品可在现有环境预览页面上探索需求可行性
- 通过 `@AI /superpowers:*` 指令触发 superpowers 流程
- 执行结果返回聊天群，所有人可见并可评论、确认
- 支持 brainstorming → writing-plans → development → 归档的完整流程

---

## 二、架构设计

### 整体布局

```
┌─────────────────────────────────────────────────────────────────┐
│                        Workspace                                  │
├──────────────────────────────┬──────────────────────────────────┤
│      TerminalWorkspace       │       CollaborationPanel          │
│  ┌───────────────────────┐   │  ┌──────────────────────────────┐ │
│  │  Tab Bar              │   │  │  Tab: [预览] [协作聊天]       │ │
│  ├───────────────────────┤   │  ├──────────────────────────────┤ │
│  │                       │   │  │                              │ │
│  │    Terminal Panel     │◄──│──│  预览标签页:                 │ │
│  │    (Claude Code CLI)  │   │  │  - URL 输入框                │ │
│  │                       │   │  │  - iframe 预览现有环境       │ │
│  │                       │   │  │  - 元素选择功能              │ │
│  │                       │   │  │                              │ │
│  │                       │   │  │  协作聊天标签页:             │ │
│  │                       │   │  │  - 主消息流                  │ │
│  │                       │   │  │  - 子线程                    │ │
│  │                       │   │  │  - 文档卡片                  │ │
│  │                       │   │  │  - 点赞/确认机制             │ │
│  │                       │   │  │  - 输入框 @AI 触发           │ │
│  ├───────────────────────┤   │  ├──────────────────────────────┤ │
│  │   Message Editor      │   │  │  输入框                      │ │
│  └───────────────────────┘   │  └──────────────────────────────┘ │
└──────────────────────────────┴──────────────────────────────────┘
```

### 前端组件结构

```
packages/web/src/components/collaboration/
├── index.tsx              # CollaborationPanel 主入口（修改）
├── preview-tab.tsx        # 预览标签页（现有展示面板迁移）
├── collaboration-tab.tsx  # 协作标签页（新增）
│   ├── draft-list.tsx     # Draft 列表（左侧）
│   ├── draft-chat.tsx     # Draft 聊天区（右侧）
│   │   ├── message-list.tsx   # 主消息流
│   │   ├── message-item.tsx   # 单条消息
│   │   ├── document-card.tsx  # 文档卡片（superpowers 结果）
│   │   ├── thread-panel.tsx   # 子线程面板
│   │   ├── confirmation-bar.tsx # 点赞/同意栏
│   │   └── chat-input.tsx     # 输入框（支持 @AI /指令）
├── shared-types.ts        # 共享类型定义
```

---

## 三、协作标签页布局

### 3.1 整体布局：Draft 列表 + 聊天区

```
┌─────────────────────────────────────────────────────────────────┐
│  协作标签页                                                      │
├────────────────────────┬────────────────────────────────────────┤
│  Draft 列表 (左侧 30%) │  Draft 聊天区 (右侧 70%)                │
│  ┌──────────────────┐  │  ┌────────────────────────────────────┐│
│  │ [新建 Draft +]   │  │  │ 当前 Draft: 登录功能需求           ││
│  ├──────────────────┤  │  │ 状态: brainstorming                ││
│  │                  │  │  ├────────────────────────────────────┤│
│  │ 📋 登录功能需求  │  │  │                                    ││
│  │    brainstorming │◄─│──│  主消息流                          ││
│  │    3人参与       │  │  │  ├─ 产品: 需求描述...              ││
│  │                  │  │  │  ├─ [文档卡片]                     ││
│  │                  │  │  │  ├─ 研发: 👍 同意                  ││
│  │ 📋 用户注册流程  │  │  │                                    ││
│  │    discussing    │  │  ├────────────────────────────────────┤│
│  │    2人参与       │  │  │                                    ││
│  │                  │  │  │  输入框: @AI /superpowers:...      ││
│  │                  │  │  │                                    ││
│  │ 📦 已归档 (2)    │  │  │                                    ││
│  │  ├─ 支付功能     │  │  │                                    ││
│  │  ├─ 搜索优化     │  │  │                                    ││
│  └──────────────────┘  │  └────────────────────────────────────┘│
└────────────────────────┴────────────────────────────────────────┘
```

### 3.2 Draft 列表设计

**列表项结构：**
```
┌──────────────────────────────┐
│ 📋 登录功能需求               │  ← 标题
│    brainstorming             │  ← 状态（带颜色标识）
│    产品张三, 研发李四...      │  ← 参与者（头像或名字）
│    更新于 10分钟前            │  ← 最后更新时间
└──────────────────────────────┘
```

**状态颜色标识：**
- `discussing` - 灰色（讨论中）
- `brainstorming` - 蓝色（头脑风暴）
- `reviewing` - 黄色（评审中）
- `developing` - 绿色（开发中）
- `confirmed` - 紫色（已确认）
- `archived` - 深灰（已归档）

**列表分组：**
- 进行中的 Draft（默认展开）
- 已归档的 Draft（可折叠）

### 3.3 Draft 隔离机制

每个 Draft 是独立的协作空间：
- **独立的消息流**：每个 Draft 有自己的聊天历史
- **独立的成员**：不同 Draft 可邀请不同人员参与
- **独立的状态**：每个 Draft 有自己的流程状态
- **独立的文档**：归档后生成独立的设计文档

切换 Draft 时：
- 断开当前 Draft 的 Yjs 连接
- 连接新 Draft 的 Yjs 文档
- 加载新 Draft 的消息历史

### 3.4 新建 Draft

点击"新建 Draft +"按钮：
```
┌────────────────────────────────────┐
│ 新建 Draft                         │
├────────────────────────────────────┤
│ 标题: [输入需求名称]               │
│                                    │
│ 邀请成员: [@选择项目成员]          │
│                                    │
│          [创建]  [取消]            │
└────────────────────────────────────┘
```

---

## 四、协作聊天交互设计

### 4.1 主消息流 + 子线程

```
┌────────────────────────────────────────────────────┐
│  协作聊天                                          │
│  ┌──────────────────────────────────────────────┐ │
│  │ 产品张三: 我想做一个用户登录功能...           │ │
│  │ 研发李四: 这个涉及到认证模块改动...           │ │
│  │                                              │ │
│  │ ┌─────────────────────────────────────────┐  │ │
│  │ │ 📄 Brainstorming 结果 - 登录功能         │  │ │ ← 文档卡片
│  │ │ 状态: ✅ 已完成                          │  │ │
│  │ │ [展开查看完整文档]                       │  │ │
│  │ │                                         │  │ │
│  │ │ 💬 子线程 (5条)                          │  │ │
│  │ │ ├─ 研发: 数据模型需要调整...            │  │ │
│  │ │ ├─ 产品: 已更新方案                     │  │ │
│  │ │ └─ 测试: 测试用例建议...                │  │ │
│  │ │                                         │  │ │
│  │ │ 👍 3人同意  👎 0人反对                   │  │ │
│  │ │ [👍 同意] [👎 反对] [💬 评论] [🔄追问]   │  │ │
│  │ └─────────────────────────────────────────┘  │ │
│  │                                              │ │
│  │ 产品张三: 👍 同意                            │ │
│  │ 研发李四: 👍 同意                            │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │ 输入框: @AI /superpowers:writing-plans       │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 4.2 @AI 指令触发

用户输入格式：
```
@AI /superpowers:<skill> [参数]
```

支持的指令：
- `@AI /superpowers:brainstorming <需求描述>` → 头脑风暴
- `@AI /superpowers:writing-plans` → 编写实现计划
- `@AI /superpowers:subagent-driven-development` → 并行开发执行
- `@AI /superpowers:finishing-a-development-branch` → 完成分支归档

执行流程：
```
用户输入 "@AI /superpowers:brainstorming xxx"
         ↓
推送到左侧 TerminalWorkspace（当前 Claude Code 会话）
         ↓
Claude Code 执行 /superpowers:brainstorming xxx
         ↓
执行完成，生成文档/摘要
         ↓
返回协作聊天（作为文档卡片）
         ↓
所有人可见，可评论、点赞、继续追问
```

### 4.3 点赞/确认机制

- 点击"👍 同意"记录确认
- 显示同意者列表
- 当同意人数达到阈值（如产品+研发都同意）→ 自动弹出提示进入下一阶段

### 4.4 继续追问

点击"🔄 继续追问"：
- 自动引用当前文档卡片内容
- 用户补充问题后发送到 Terminal
- Terminal 执行时带上引用上下文

### 4.5 归档流程

执行 `/superpowers:finishing-a-development-branch` 后：
- 生成最终设计文档
- 保存到 `docs/designs/YYYY-MM-DD-<topic>.md`
- 显示归档卡片，包含完整流程记录和参与者

---

## 五、标准协作流程

```
┌─────────────────────────────────────────────────────────────┐
│  1. 需求讨论                                                 │
│     产品在预览标签页查看现有环境                              │
│     在协作聊天描述需求                                        │
│                                                             │
│     @AI /superpowers:brainstorming 登录功能需要支持...      │
├─────────────────────────────────────────────────────────────┤
│  2. 方案设计                                                 │
│     Brainstorming 结果返回聊天                               │
│     产品、研发、设计评论确认                                  │
│     达到阈值后提示进入下一阶段                                │
│                                                             │
│     @AI /superpowers:writing-plans                          │
├─────────────────────────────────────────────────────────────┤
│  3. 开发执行                                                 │
│     实现计划返回聊天                                         │
│     研发确认后开始开发                                        │
│                                                             │
│     @AI /superpowers:subagent-driven-development            │
├─────────────────────────────────────────────────────────────┤
│  4. 完成归档                                                 │
│     开发完成后执行归档                                        │
│     生成设计文档入库                                         │
│                                                             │
│     @AI /superpowers:finishing-a-development-branch         │
│                                                             │
│     → 保存到 docs/designs/2026-04-18-login-feature.md      │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、数据模型

### 6.1 Draft（草稿工作区）

```sql
CREATE TABLE drafts (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'discussing',
  -- discussing, brainstorming, reviewing, developing, confirmed, archived
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 6.2 Draft 成员

```sql
CREATE TABLE draft_members (
  id INTEGER PRIMARY KEY,
  draft_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'participant',  -- owner, participant
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (draft_id) REFERENCES drafts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(draft_id, user_id)
);
```

### 6.3 聊天消息

```sql
CREATE TABLE draft_messages (
  id INTEGER PRIMARY KEY,
  draft_id INTEGER NOT NULL,
  parent_id INTEGER,  -- NULL 为主消息流，有值为子线程
  user_id INTEGER NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  -- text, image, code, document_card, ai_command, system
  metadata TEXT,  -- JSON: 文档卡片内容、图片URL、AI指令信息等
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (draft_id) REFERENCES drafts(id),
  FOREIGN KEY (parent_id) REFERENCES draft_messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 6.4 消息确认

```sql
CREATE TABLE message_confirmations (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT DEFAULT 'agree',  -- agree, disagree, suggest
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (message_id) REFERENCES draft_messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(message_id, user_id)
);
```

---

## 七、实时同步机制

### 技术方案：Yjs + Hocuspocus

采用 CRDT（Conflict-free Replicated Data Types）实现强实时同步，支持：
- 多人同时编辑消息
- 离线编辑后自动合并
- 网络中断恢复

### 7.1 架构

```
前端 (Yjs Document)
    ↕ WebSocket
Hocuspocus Server (新增)
    ↕
SQLite (持久化)
```

### 7.2 前端客户端

```typescript
// packages/web/src/lib/collaboration-client.ts
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

export class CollaborationClient {
  private ydoc: Y.Doc;
  private provider: HocuspocusProvider;
  
  connect(draftId: number, token: string) {
    this.ydoc = new Y.Doc();
    this.provider = new HocuspocusProvider({
      url: `${WS_URL}/collaboration`,
      name: `draft-${draftId}`,
      document: this.ydoc,
      token: token,
    });
  }
  
  sendMessage(content: string, parentMessageId?: number) {
    const messages = this.ydoc.getArray('messages');
    messages.push([{ content, parentMessageId, timestamp: Date.now() }]);
  }
  
  confirmMessage(messageId: number, type: 'agree' | 'disagree') {
    const confirmations = this.ydoc.getMap('confirmations');
    confirmations.set(`${messageId}-${this.userId}`, { type, timestamp: Date.now() });
  }
}
```

### 7.3 后端 Hocuspocus 服务

```typescript
// packages/server/src/hocuspocus-server.ts
import { Server } from '@hocuspocus/server';

export function createHocuspocusServer(db: Database.Database) {
  return Server.configure({
    name: 'code-link-collaboration',
    
    onConnect: async ({ connection, request }) => {
      const token = request.headers.authorization;
      const user = verifyToken(token);
      connection.context = { user };
    },
    
    onLoadDocument: async ({ documentName }) => {
      const draftId = parseInt(documentName.replace('draft-', ''), 10);
      // 从 SQLite 加载历史消息
    },
    
    onSaveDocument: async ({ documentName, state }) => {
      // 将 Yjs state 持久化到 SQLite
    },
  });
}
```

---

## 八、@AI 指令实现

### 8.1 指令解析

```typescript
// packages/web/src/components/collaboration/chat-input.tsx
function parseAICommand(input: string): AICommand | null {
  const match = input.match(/^@AI\s+(\/superpowers:\w+)\s*(.*)$/);
  if (match) {
    return {
      isAICommand: true,
      skill: match[1],        // '/superpowers:brainstorming'
      args: match[2].trim(),  // 用户补充的参数
    };
  }
  return null;
}

// 发送时处理
if (command) {
  pushToTerminal({
    type: 'ai_command',
    skill: command.skill,
    args: command.args,
    draftId: currentDraft.id,
    userId: currentUser.id,
    context:引用的文档内容（如果有）
  });
}
```

### 8.2 Terminal 监听

```typescript
// packages/web/src/components/terminal/terminal-panel.tsx
useEffect(() => {
  const handleAICommand = (event: CustomEvent<AICommandMessage>) => {
    const { skill, args, context } = event.detail;
    const fullPrompt = context ? `${context}\n\n${args}` : args;
    // 发送到 Claude Code CLI
    sendToTerminal(`${skill} ${fullPrompt}`);
  };
  
  window.addEventListener('ai_command', handleAICommand);
  return () => window.removeEventListener('ai_command', handleAICommand);
}, []);
```

### 8.3 结果返回

执行完成后，后端解析 Claude Code 输出：
- 如果生成了文档文件 → 读取文档内容
- 如果没有文档 → 提取关键输出生成摘要

通过 WebSocket 广播到 Draft 所有参与者：

```typescript
// packages/server/src/websocket/ai-result-handler.ts
export function handleAIResult(result: AIResult): void {
  channelManager.broadcast(draftId, {
    type: 'document_card',
    messageId: generateMessageId(),
    userId: result.userId,
    userName: result.userName,
    skill: result.skill,
    title: result.title,
    summary: result.summary,
    documentPath: result.documentPath,
  });
}
```

---

## 九、后端 API

### 9.1 路由设计

```typescript
// packages/server/src/routes/drafts.ts

router.post('/', authMiddleware, createDraft);           // 创建 Draft
router.get('/:draftId', authMiddleware, getDraft);       // 获取详情
router.get('/:draftId/messages', authMiddleware, getMessages);  // 获取消息
router.post('/:draftId/members', authMiddleware, addMember);    // 添加成员
router.post('/:draftId/messages/:messageId/confirm', authMiddleware, confirmMessage);  // 确认
router.post('/:draftId/archive', authMiddleware, archiveDraft); // 归档
```

### 9.2 WebSocket 消息类型扩展

```typescript
// packages/server/src/websocket/types.ts (扩展)

export type MessageType =
  | 'draft_message'        // 聊天消息
  | 'draft_message_update' // 消息更新
  | 'document_card'        // superpowers 结果
  | 'confirmation'         // 点赞/确认
  | 'ai_command'           // @AI 指令
  | 'ai_result'            // AI 结果返回
  | 'draft_status_change'; // Draft 状态变更
```

---

## 十、确认阈值机制

### 10.1 阈值配置

Draft 可以配置确认阈值：
- 默认：需要 owner + 至少一个研发同意
- 可自定义：如需要产品 + 研发 + 测试都同意

### 10.2 阈值触发

```typescript
function checkConfirmationThreshold(messageId: number): boolean {
  const confirmations = getConfirmations(messageId);
  const agreeCount = confirmations.filter(c => c.type === 'agree').length;
  
  // 检查角色覆盖
  const rolesConfirmed = new Set(confirmations.map(c => c.userRole));
  
  if (agreeCount >= threshold && rolesConfirmed.has('研发')) {
    // 触发提示：是否进入下一阶段？
    broadcastPrompt({
      type: 'stage_transition_prompt',
      currentStage: 'brainstorming',
      nextStage: 'writing-plans',
    });
    return true;
  }
  return false;
}
```

---

## 十一、归档流程

### 11.1 文档生成

归档时自动生成设计文档，保存到：

```
docs/designs/YYYY-MM-DD-<draft-title>.md
```

文档内容包含：
- 需求描述
- Brainstorming 结果
- 实现计划
- 开发记录
- 参与者列表
- 时间线

### 11.2 归档卡片

归档完成后在聊天中显示归档卡片：

```
┌─────────────────────────────────────────────────────┐
│ 📦 需求归档 - 登录功能                               │
│ ─────────────────────────────────────────────────── │
│ 状态: ✅ 已归档                                      │
│ 文档位置: docs/designs/2026-04-18-login-feature.md │
│                                                     │
│ 完整流程:                                            │
│ brainstorming → writing-plans → development → 归档 │
│                                                     │
│ 参与者: 产品张三, 研发李四, 测试王五                 │
│                                                     │
│ [查看文档] [查看历史记录]                           │
└─────────────────────────────────────────────────────┘
```

---

## 十二、并行执行支持

多人可同时触发 superpowers：
- 产品 A 触发 brainstorming → 在 A 的 Terminal 执行 → 结果返回聊天群
- 研发 B 同时触发 writing-plans → 在 B 的 Terminal 执行 → 结果返回聊天群

每个结果都作为独立的文档卡片出现在聊天中，所有人可见可评论。

---

## 十三、依赖引入

### 新增依赖

**后端：**
- `@hocuspocus/server` - Hocuspocus WebSocket 服务
- `yjs` - CRDT 文档

**前端：**
- `yjs` - CRDT 客户端
- `@hocuspocus/provider` - Hocuspocus 连接 provider

---

## 十四、实现计划概要

1. 数据库 schema 扩展（drafts, draft_members, draft_messages, message_confirmations）
2. 后端 drafts 路由 + Hocuspocus 服务
3. WebSocket 消息类型扩展
4. 前端 CollaborationPanel 改造（预览标签页 + 协作聊天标签页）
5. Yjs 实时同步集成
6. @AI 指令解析 + Terminal 推送
7. 文档卡片组件 + 子线程 + 点赞确认
8. 归档流程 + 文档生成

---

## 十五、风险与注意事项

1. **API Key 使用**：按需触发，使用触发者的 user_claude_configs 中的 Key
2. **实时同步冲突**：Yjs CRDT 自动处理，但需测试极端场景
3. **文档内容长度**：超长文档卡片需要折叠展示，避免聊天流过长
4. **子线程深度**：限制子线程层级，避免过深嵌套