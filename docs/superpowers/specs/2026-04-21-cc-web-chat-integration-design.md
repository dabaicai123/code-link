# 左屏聊天 UI 移植设计文档

## 概述

将 cc-web (https://github.com/ZgDaniel/cc-web) 的聊天交互界面完整移植为 React 组件，替代 code-link 左屏现有的 TerminalWorkspace。去掉 cc-web 的侧边栏会话列表，只保留聊天主区域。同时兼容 code-link 现有的左右屏联动和项目侧边栏联动。

## 方案选择

**方案 A：完整移植 cc-web 聊天 UI 为 React 组件**

把 cc-web 的聊天主区域（消息列表 + Markdown 渲染 + 工具调用折叠块 + 输入区）逐组件移植为 React/Tailwind 组件，融入现有 TerminalWorkspace 的位置。通信层复用 Socket.IO `/terminal` namespace，把 cc-web 的 WebSocket 消息类型映射到现有事件。

选择理由：完全融入现有架构，联动最自然，长期维护性最好。

## 组件架构

左屏由 `TerminalWorkspace` 变为 `ChatWorkspace`，替代组件层级如下：

```
ChatWorkspace (替代 TerminalWorkspace)
├── ChatHeader
│   ├── 项目名 + 运行状态
│   ├── 代理选择器 (Claude/Codex) ← 从 cc-web 移植
│   └── 权限模式下拉 (Default/Plan/YOLO) ← 从 cc-web 移植
│
├── MessageList
│   ├── WelcomeScreen (空状态)
│   └── MessageItem[]
│       ├── 用户消息 (气泡样式)
│       ├── 助手消息 (Markdown 渲染 + highlight.js 代码高亮)
│       └── ToolCallBlock (可折叠工具调用展示)
│
├── InputArea (替代 MessageEditor)
│   ├── SlashCommandMenu (/ 斜杠命令菜单) ← 从 cc-web 移植
│   ├── AttachmentTray (图片上传，最多4张) ← 从 cc-web 移植
│   ├── 文本输入框 (多行)
│   └── 发送/中止按钮
```

### 关键移植点

| cc-web 函数/组件 | React 组件 | 说明 |
|---|---|---|
| `renderAssistantMessage()` | `AssistantMessage` | Markdown + 代码高亮渲染 |
| ToolCallBlock 逻辑 | `ToolCallBlock` | 折叠展示 + 工具状态 |
| `renderInput()` | `ChatInput` | 输入区完整逻辑 |
| SlashCommandMenu | `SlashCommandMenu` | / 斜杠命令弹出菜单 |
| 附件上传逻辑 | `AttachmentTray` | 图片上传预览 |

### 文件结构

新组件放在 `packages/web/src/components/chat/` 目录下：

```
components/chat/
├── index.tsx          # ChatWorkspace 主组件
├── chat-header.tsx    # 头部（项目名 + 代理 + 权限模式）
├── message-list.tsx   # 消息列表容器
├── message-item.tsx   # 单条消息（区分用户/助手/工具调用）
├── assistant-message.tsx  # 助手消息 Markdown 渲染
├── tool-call-block.tsx    # 工具调用折叠块
├── chat-input.tsx     # 输入区（替代 MessageEditor）
├── slash-command-menu.tsx # 斜杠命令菜单
├── attachment-tray.tsx    # 附件上传托盘
└── welcome-screen.tsx    # 空状态欢迎页
```

## 通信层映射

复用现有 Socket.IO `/terminal` namespace，映射 cc-web 的 WebSocket 消息类型：

| cc-web 消息 | Socket.IO 映射 | 说明 |
|---|---|---|
| `message` (用户输入) | `/terminal` `claude-message` | 发送用户消息 + 选中元素 |
| `text_delta` | `/terminal` 新增 `claude-stream` | 流式回复文本增量 |
| `tool_start` / `tool_end` | `/terminal` 新增 `tool-start` / `tool-end` | 工具调用生命周期 |
| `done` / `error` | `/terminal` 新增 `claude-done` / `claude-error` | 完成/错误信号 |
| `cost` / `usage` | `/terminal` 新增 `cost` / `usage` | token/cost 信息 |
| `abort` | `/terminal` `kill` | 中止运行 |

### 服务端改动

- `/terminal` namespace 新增事件类型：`claude-stream`, `tool-start`, `tool-end`, `claude-done`, `claude-error`, `cost`, `usage`
- 现有 `claude-message` 事件扩展，支持携带附件/图片信息
- Claude CLI 进程的输出需要从原始终端流解析为结构化消息（区分 text_delta、tool_start 等）
- 服务端需要实现类似 cc-web 的 JSONL 输出解析逻辑

### 不改动的部分

- `/project` namespace — 项目联动不变
- `/draft` namespace — 协作面板联动不变

### Socket Hook 更新

`useTerminalSocket()` hook 需要扩展，新增：
- `onClaudeStream(callback)` — 监听流式文本增量
- `onToolStart(callback)` — 监听工具调用开始
- `onToolEnd(callback)` — 监听工具调用结束
- `onClaudeDone(callback)` — 监听完成信号
- `onCost(callback)` — 监听 cost 信息

## 页面联动

### 左右屏联动

1. **元素选择 → 聊天输入：** 右侧 CollaborationPanel 的 DisplayPanel 选中元素后，元素信息直接注入到左屏 `ChatInputArea` 的输入框。通过 Workspace 组件的 `selectedElements` state 传递，逻辑与原 MessageEditor 一致。

2. **聊天指令 → 右屏响应：** 左屏发送的消息如果包含页面操作指令，右侧 iframe 可以根据指令刷新/跳转。通过 `/project` namespace 的 `chat` 事件协调。

### 项目侧边栏联动

1. **切换项目 → 重置聊天：** Sidebar 中切换项目时，`ChatWorkspace` 清空当前消息、建立新的 terminal session。通过 `useProjectSocket()` 的 `subscribe` 事件触发。

2. **项目运行状态 → 聊天头状态：** Sidebar 的项目 `isRunning` 状态实时反映到 `ChatHeader` 的状态指示器。通过 `useSidebarProjects` → `ChatWorkspace` props 传递。

### 实现方式

- 元素传递：保持在 `Workspace` 组件 state 中管理 `selectedElements`，props 传递给 `ChatInputArea`
- 项目切换：`useProjectSocket()` hook 的 `subscribe` 事件触发 session 重置
- 状态同步：`useSidebarProjects` → `ChatWorkspace` props

## 样式体系

### 主题风格

聊天 UI 采用 **washi（米黄）主题** — 和纸风格，温暖文雅基调。

### washi 关键色彩

| 元素 | 色值参考 | 说明 |
|---|---|---|
| 背景底色 | `#f5f0e8` / `#faf6ed` | 米黄/米白 |
| 文字 | 深棕/墨色 `#2d2416` | 深色文字 |
| 代码块背景 | 浅米 `#eee8d5` | 代码区域 |
| 消息气泡 | 白/淡米 `#fffaef` | 轻微阴影 |
| 工具调用块 | 更深米色 `#e8dcc8` | 区分层级 |
| 链接/强调 | 深棕红 `#8b4513` | 交互元素 |

### 与暗色体系的衔接

- `ChatWorkspace` 内部使用 washi 米黄风格
- 左屏之外（Sidebar、CollaborationPanel）保持现有暗色体系
- `ResizableSplit` 边界处做自然色彩过渡

### 移植样式清单

| cc-web 样式 | 实现方式 |
|---|---|
| Markdown 渲染 | `marked` + `highlight.js`，配色适配 washi |
| 消息布局 | Tailwind flex/grid，气泡用米黄底色 |
| 输入区 | Tailwind 组件，浅米色背景 |
| 工具调用块 | Tailwind + 自定义折叠样式 |

### 不移植的样式

- cc-web 侧边栏样式（不需要）
- cc-web 登录页面样式
- cc-web 主题切换器

## 删除的组件

移植完成后，以下组件将被移除：

- `packages/web/src/components/terminal/index.tsx` — TerminalWorkspace
- `packages/web/src/components/terminal/terminal-panel.tsx` — xterm.js 终端
- `packages/web/src/components/terminal/tab-bar.tsx` — 终端标签栏
- `packages/web/src/components/terminal/message-editor.tsx` — 消息输入编辑器

## 数据模型

### Attachment 类型

```typescript
interface Attachment {
  id: string;
  type: 'image';
  url: string;        // 上传后的 URL 或本地预览 URL
  name: string;
  status: 'pending' | 'uploaded' | 'error';
}
```

### ChatMessage 类型

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  elements?: SelectedElement[];  // 用户消息附带的选中元素
  toolCall?: {
    name: string;
    input: string;
    output?: string;
    status: 'running' | 'completed' | 'error';
  };
  attachments?: Attachment[];    // 图片附件
  cost?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}
```

### Session 状态

```typescript
interface ChatSessionState {
  messages: ChatMessage[];
  isRunning: boolean;
  agent: 'claude' | 'codex';
  permissionMode: 'default' | 'plan' | 'yolo';
  streamingContent: string;  // 流式输出中间状态
}
```

用 `useReducer` 管理 `ChatSessionState`，与 cc-web 的消息追加 + 流式更新逻辑对齐。

## 错误处理

- 连接中断：显示断连提示，自动重连后恢复 session
- 流式输出中断：保留已收到的内容，标记为"不完整"
- 工具调用错误：ToolCallBlock 显示错误状态 + 错误信息
- 图片上传失败：附件托盘显示失败状态，可重试

## 测试策略

- 单元测试：各 React 组件的渲染和交互
- 集成测试：Socket.IO 事件映射和消息流
- E2E 测试：左屏聊天 → 右屏联动场景