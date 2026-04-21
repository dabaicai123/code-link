# cc-web Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace left-screen TerminalWorkspace with cc-web-style ChatWorkspace, preserving page linkage.

**Architecture:** Port cc-web vanilla JS chat UI to React/Tailwind components in washi theme. Reuse Socket.IO `/terminal` namespace with new structured events. Keep existing element/project linkage via props.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS 4, Socket.IO, marked, highlight.js, Zustand

---

## Phase 1: Foundation — Types & Socket Extension

### Task 1: Add Chat Types

**Files:**
- Create: `packages/web/src/types/chat.ts`
- Modify: `packages/web/src/types/index.ts`

- [ ] **Step 1: Create chat.ts with data model types**

```typescript
// packages/web/src/types/chat.ts

export interface Attachment {
  id: string;
  type: 'image';
  url: string;
  name: string;
  size: number;
  status: 'pending' | 'uploaded' | 'error';
}

export interface ToolCall {
  id: string;
  name: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'error';
  kind?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: number;
  elements?: import('./claude-message').SelectedElement[];
  toolCall?: ToolCall;
  attachments?: Attachment[];
  cost?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

export type AgentType = 'claude' | 'codex';
export type PermissionMode = 'default' | 'plan' | 'yolo';

export interface ChatSessionState {
  messages: ChatMessage[];
  isRunning: boolean;
  agent: AgentType;
  permissionMode: PermissionMode;
  streamingContent: string;
}

export type ChatAction =
  | { type: 'ADD_USER_MESSAGE'; message: ChatMessage }
  | { type: 'START_STREAMING' }
  | { type: 'APPEND_STREAM'; content: string }
  | { type: 'FINISH_STREAM'; content: string; cost?: ChatMessage['cost'] }
  | { type: 'ADD_TOOL_CALL'; toolCall: ToolCall }
  | { type: 'UPDATE_TOOL_CALL'; id: string; output: string; status: ToolCall['status'] }
  | { type: 'SET_RUNNING'; isRunning: boolean }
  | { type: 'SET_AGENT'; agent: AgentType }
  | { type: 'SET_PERMISSION_MODE'; mode: PermissionMode }
  | { type: 'RESET_SESSION' };
```

- [ ] **Step 2: Export chat types from index.ts**

Add to `packages/web/src/types/index.ts`:

```typescript
// Chat
export * from './chat';
```

- [ ] **Step 3: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/types/chat.ts packages/web/src/types/index.ts
git -C /home/lsx/code-link commit -m "feat: add chat data model types"
```

---

### Task 2: Extend Server Socket Types & Handler

**Files:**
- Modify: `packages/server/src/socket/types.ts` (add new event schemas)
- Modify: `packages/server/src/socket/namespaces/terminal.ts` (add event handlers)
- Modify: `packages/web/src/lib/socket/types.ts` (mirror client-side types)

- [ ] **Step 1: Add new event schemas to server types.ts**

In `packages/server/src/socket/types.ts`, add to `TerminalEvents`:

```typescript
// 客户端 -> 服务端 (新增)
  claudeMessage: z.object({
    sessionId: z.string(),
    data: z.string(),
    mode: z.enum(['default', 'plan', 'yolo']).optional(),
    agent: z.enum(['claude', 'codex']).optional(),
  }),

  // 服务端 -> 客户端 (新增)
  claudeStream: z.object({
    sessionId: z.string(),
    text: z.string(),
  }),
  toolStart: z.object({
    sessionId: z.string(),
    toolUseId: z.string(),
    name: z.string(),
    input: z.string(),
    kind: z.string().optional(),
  }),
  toolEnd: z.object({
    sessionId: z.string(),
    toolUseId: z.string(),
    result: z.string().optional(),
  }),
  claudeDone: z.object({
    sessionId: z.string(),
    cost: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalCost: z.number(),
    }).optional(),
  }),
  claudeError: z.object({
    sessionId: z.string(),
    message: z.string(),
  }),
  cost: z.object({
    sessionId: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalCost: z.number(),
  }),
```

Add type exports:

```typescript
export type TerminalClaudeStreamEvent = z.infer<typeof TerminalEvents.claudeStream>;
export type TerminalToolStartEvent = z.infer<typeof TerminalEvents.toolStart>;
export type TerminalToolEndEvent = z.infer<typeof TerminalEvents.toolEnd>;
export type TerminalClaudeDoneEvent = z.infer<typeof TerminalEvents.claudeDone>;
export type TerminalClaudeErrorEvent = z.infer<typeof TerminalEvents.claudeError>;
export type TerminalCostEvent = z.infer<typeof TerminalEvents.cost>;
```

- [ ] **Step 2: Add new event schemas to client types.ts**

In `packages/web/src/lib/socket/types.ts`, add to `TerminalEvents` the same schemas as server (claudeStream, toolStart, toolEnd, claudeDone, claudeError, cost). Also add `claudeMessage` to the client-side types (it was missing).

```typescript
// 客户端 -> 服务端
  claudeMessage: z.object({
    sessionId: z.string(),
    data: z.string(),
    mode: z.enum(['default', 'plan', 'yolo']).optional(),
    agent: z.enum(['claude', 'codex']).optional(),
  }),

  // 服务端 -> 客户端 (新增)
  claudeStream: z.object({
    sessionId: z.string(),
    text: z.string(),
  }),
  toolStart: z.object({
    sessionId: z.string(),
    toolUseId: z.string(),
    name: z.string(),
    input: z.string(),
    kind: z.string().optional(),
  }),
  toolEnd: z.object({
    sessionId: z.string(),
    toolUseId: z.string(),
    result: z.string().optional(),
  }),
  claudeDone: z.object({
    sessionId: z.string(),
    cost: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalCost: z.number(),
    }).optional(),
  }),
  claudeError: z.object({
    sessionId: z.string(),
    message: z.string(),
  }),
  cost: z.object({
    sessionId: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalCost: z.number(),
  }),
```

- [ ] **Step 3: Add server-side event handlers in terminal namespace**

In `packages/server/src/socket/namespaces/terminal.ts`, the server currently sends raw terminal output via the `createSocketIOWriter` adapter. We need to add a Claude output parser that intercepts the terminal stream and emits structured events.

This is the most complex part of Phase 1. The approach: keep the raw `output` event for backward compatibility, but add a new `claudeStreamParser` that parses Claude CLI's JSONL output and emits the structured events.

In `packages/server/src/modules/container/lib/terminal-manager.ts`, modify the `createSession` method's stream listener to also parse Claude JSONL output:

```typescript
// In the stream.on('data') callback, after sending raw output:
execSession.stream.on('data', (data: Buffer) => {
  // Send raw terminal output (backward compat)
  this.sendToWebSocket(ws, {
    type: 'output',
    data: data.toString('base64'),
  });

  // Parse Claude CLI JSONL output for structured events
  const text = data.toString('utf-8');
  this.parseClaudeOutput(ws, sessionId, text);
});
```

Add `parseClaudeOutput` method to TerminalManagerImpl:

```typescript
private parseClaudeOutput(ws: WebSocketLike, sessionId: string, text: string): void {
  // Claude CLI outputs JSONL lines with specific format
  // Each line is a JSON object with type field
  const lines = text.split('\n').filter(line => line.trim());
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      switch (event.type) {
        case 'assistant':
          if (event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                this.sendToWebSocket(ws, {
                  type: 'claudeStream',
                  sessionId,
                  text: block.text,
                });
              } else if (block.type === 'tool_use') {
                this.sendToWebSocket(ws, {
                  type: 'toolStart',
                  sessionId,
                  toolUseId: block.id,
                  name: block.name,
                  input: JSON.stringify(block.input),
                });
              }
            }
          }
          break;
        case 'tool_result':
          this.sendToWebSocket(ws, {
            type: 'toolEnd',
            sessionId,
            toolUseId: event.tool_use_id,
            result: event.content,
          });
          break;
        case 'result':
          this.sendToWebSocket(ws, {
            type: 'claudeDone',
            sessionId,
            cost: event.cost_usd ? {
              inputTokens: event.input_tokens ?? 0,
              outputTokens: event.output_tokens ?? 0,
              totalCost: event.cost_usd,
            } : undefined,
          });
          break;
        case 'error':
          this.sendToWebSocket(ws, {
            type: 'claudeError',
            sessionId,
            message: event.message || 'Unknown error',
          });
          break;
      }
    } catch {
      // Not JSON - skip, it's raw terminal output
    }
  }
}
```

- [ ] **Step 4: Update claude-message handler to accept mode/agent**

In `packages/server/src/socket/namespaces/terminal.ts`, update the `claude-message` handler to pass mode/agent to the terminal:

```typescript
socket.on('claude-message', (data: unknown) => {
  const parsed = TerminalEvents.claudeMessage.safeParse(data);
  if (!parsed.success || !currentSessionId) return;

  const { sessionId, data: encodedMessage, mode, agent } = parsed.data;
  if (sessionId !== currentSessionId) return;

  // If mode or agent specified, prepend flags to the message
  let decoded = Buffer.from(encodedMessage, 'base64').toString('utf-8');
  if (mode) {
    // Mode is handled by the CLI itself via the claude-message format
    // No special server-side processing needed
  }
  terminalManager.sendToTerminal(sessionId, encodedMessage);
});
```

- [ ] **Step 5: Commit**

```bash
git -C /home/lsx/code-link add packages/server/src/socket/types.ts packages/server/src/socket/namespaces/terminal.ts packages/server/src/modules/container/lib/terminal-manager.ts packages/web/src/lib/socket/types.ts
git -C /home/lsx/code-link commit -m "feat: extend socket types with structured chat events"
```

---

### Task 3: Extend useTerminalSocket Hook

**Files:**
- Modify: `packages/web/src/lib/socket/terminal.ts`

- [ ] **Step 1: Add new event listeners to useTerminalSocket**

Replace the current hook with an extended version that supports all new chat events. Add new callbacks to the options interface and register the listeners:

```typescript
interface UseTerminalSocketOptions {
  projectId: number | null;
  onOutput?: (data: string) => void;
  onExit?: () => void;
  onError?: (message: string) => void;
  // New chat event callbacks
  onClaudeStream?: (text: string) => void;
  onToolStart?: (data: { toolUseId: string; name: string; input: string; kind?: string }) => void;
  onToolEnd?: (data: { toolUseId: string; result?: string }) => void;
  onClaudeDone?: (data: { cost?: { inputTokens: number; outputTokens: number; totalCost: number } }) => void;
  onClaudeError?: (message: string) => void;
  onCost?: (data: { inputTokens: number; outputTokens: number; totalCost: number }) => void;
}
```

In the second useEffect (the one that registers event listeners), add:

```typescript
const handleClaudeStream = (data: { sessionId: string; text: string }) => {
  onClaudeStream?.(data.text);
};

const handleToolStart = (data: { sessionId: string; toolUseId: string; name: string; input: string; kind?: string }) => {
  onToolStart?.(data);
};

const handleToolEnd = (data: { sessionId: string; toolUseId: string; result?: string }) => {
  onToolEnd?.(data);
};

const handleClaudeDone = (data: { sessionId: string; cost?: { inputTokens: number; outputTokens: number; totalCost: number } }) => {
  onClaudeDone?.(data);
};

const handleClaudeError = (data: { sessionId: string; message: string }) => {
  onClaudeError?.(data.message);
};

const handleCost = (data: { sessionId: string; inputTokens: number; outputTokens: number; totalCost: number }) => {
  onCost?.(data);
};

socket.on('claude-stream', handleClaudeStream);
socket.on('tool-start', handleToolStart);
socket.on('tool-end', handleToolEnd);
socket.on('claude-done', handleClaudeDone);
socket.on('claude-error', handleClaudeError);
socket.on('cost', handleCost);

// In cleanup:
socket.off('claude-stream', handleClaudeStream);
socket.off('tool-start', handleToolStart);
socket.off('tool-end', handleToolEnd);
socket.off('claude-done', handleClaudeDone);
socket.off('claude-error', handleClaudeError);
socket.off('cost', handleCost);
```

- [ ] **Step 2: Extend sendClaudeMessage to accept mode/agent**

```typescript
const sendClaudeMessage = useCallback(
  (elements: SelectedElement[], userRequest: string, mode?: PermissionMode, agent?: AgentType) => {
    if (!sessionIdRef.current) {
      console.warn('Terminal session not started');
      return;
    }

    const message: ClaudeMessage = {
      type: 'claude-request',
      elements,
      userRequest,
      timestamp: Date.now(),
    };

    const formattedMessage = formatClaudeMessage(message);
    const encoded = encodeBase64(formattedMessage + '\n');

    socket.emit('claude-message', {
      sessionId: sessionIdRef.current,
      data: encoded,
      mode,
      agent,
    });
  },
  [socket]
);
```

Add the import at the top:

```typescript
import type { PermissionMode, AgentType } from '@/types/chat';
```

- [ ] **Step 3: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/lib/socket/terminal.ts
git -C /home/lsx/code-link commit -m "feat: extend useTerminalSocket with chat event callbacks"
```

---

### Task 4: Install marked & highlight.js Dependencies

**Files:**
- Modify: `packages/web/package.json`

- [ ] **Step 1: Install marked and highlight.js**

```bash
cd /home/lsx/code-link && pnpm --filter @code-link/web add marked highlight.js
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/web/package.json pnpm-lock.yaml
git -C /home/lsx/code-link commit -m "deps: add marked and highlight.js for chat markdown rendering"
```

---

## Phase 2: Chat Components — Core UI

### Task 5: Chat Session Reducer & Hook

**Files:**
- Create: `packages/web/src/components/chat/chat-reducer.ts`

- [ ] **Step 1: Create chatReducer and useChatSession hook**

```typescript
// packages/web/src/components/chat/chat-reducer.ts
'use client';

import { useReducer, useCallback } from 'react';
import type { ChatSessionState, ChatAction, ChatMessage, ToolCall, AgentType, PermissionMode } from '@/types/chat';

const initialState: ChatSessionState = {
  messages: [],
  isRunning: false,
  agent: 'claude',
  permissionMode: 'default',
  streamingContent: '',
};

function chatReducer(state: ChatSessionState, action: ChatAction): ChatSessionState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'START_STREAMING':
      return { ...state, isRunning: true, streamingContent: '' };

    case 'APPEND_STREAM':
      return { ...state, streamingContent: state.streamingContent + action.content };

    case 'FINISH_STREAM': {
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: action.content,
        timestamp: Date.now(),
        cost: action.cost,
      };
      return {
        ...state,
        messages: [...state.messages, assistantMsg],
        isRunning: false,
        streamingContent: '',
      };
    }

    case 'ADD_TOOL_CALL': {
      const toolMsg: ChatMessage = {
        id: `tool-${action.toolCall.id}`,
        role: 'tool',
        content: action.toolCall.input,
        timestamp: Date.now(),
        toolCall: action.toolCall,
      };
      return { ...state, messages: [...state.messages, toolMsg] };
    }

    case 'UPDATE_TOOL_CALL':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.toolCall?.id === action.id
            ? { ...msg, toolCall: { ...msg.toolCall!, output: action.output, status: action.status } }
            : msg
        ),
      };

    case 'SET_RUNNING':
      return { ...state, isRunning: action.isRunning };

    case 'SET_AGENT':
      return { ...state, agent: action.agent };

    case 'SET_PERMISSION_MODE':
      return { ...state, permissionMode: action.mode };

    case 'RESET_SESSION':
      return initialState;

    default:
      return state;
  }
}

export function useChatSession() {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const addUserMessage = useCallback((content: string, elements?: import('@/types/claude-message').SelectedElement[], attachments?: import('@/types/chat').Attachment[]) => {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      elements,
      attachments,
    };
    dispatch({ type: 'ADD_USER_MESSAGE', message: msg });
  }, []);

  const startStreaming = useCallback(() => dispatch({ type: 'START_STREAMING' }), []);
  const appendStream = useCallback((content: string) => dispatch({ type: 'APPEND_STREAM', content }), []);
  const finishStream = useCallback((content: string, cost?: ChatMessage['cost']) => dispatch({ type: 'FINISH_STREAM', content, cost }), []);
  const addToolCall = useCallback((toolCall: ToolCall) => dispatch({ type: 'ADD_TOOL_CALL', toolCall }), []);
  const updateToolCall = useCallback((id: string, output: string, status: ToolCall['status']) => dispatch({ type: 'UPDATE_TOOL_CALL', id, output, status }), []);
  const setRunning = useCallback((isRunning: boolean) => dispatch({ type: 'SET_RUNNING', isRunning }), []);
  const setAgent = useCallback((agent: AgentType) => dispatch({ type: 'SET_AGENT', agent }), []);
  const setPermissionMode = useCallback((mode: PermissionMode) => dispatch({ type: 'SET_PERMISSION_MODE', mode }), []);
  const resetSession = useCallback(() => dispatch({ type: 'RESET_SESSION' }), []);

  return {
    state,
    addUserMessage,
    startStreaming,
    appendStream,
    finishStream,
    addToolCall,
    updateToolCall,
    setRunning,
    setAgent,
    setPermissionMode,
    resetSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/chat/chat-reducer.ts
git -C /home/lsx/code-link commit -m "feat: add chat session reducer and hook"
```

---

### Task 6: AssistantMessage — Markdown Rendering Component

**Files:**
- Create: `packages/web/src/components/chat/assistant-message.tsx`

- [ ] **Step 1: Create AssistantMessage component**

This component renders assistant messages with Markdown + code highlighting, ported from cc-web's `renderMarkdown()` and custom `marked.Renderer`.

```tsx
// packages/web/src/components/chat/assistant-message.tsx
'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.min.css';

// Configure marked with custom code renderer
const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = (lang || 'plaintext').toLowerCase();
  let highlighted: string;
  try {
    if (hljs.getLanguage(language)) {
      highlighted = hljs.highlight(text, { language }).value;
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }
  } catch {
    highlighted = text;
  }
  return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang">${language}</span><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').textContent)">Copy</button></div><pre class="hljs"><code class="language-${language}">${highlighted}</code></pre></div>`;
};

marked.setOptions({ renderer, breaks: true, gfm: true });

interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

export function AssistantMessage({ content, isStreaming }: AssistantMessageProps) {
  const html = useMemo(() => {
    if (!content && isStreaming) {
      return '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    }
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content, isStreaming]);

  return (
    <div
      className="msg-text text-[#2d1f14] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/chat/assistant-message.tsx
git -C /home/lsx/code-link commit -m "feat: add AssistantMessage markdown rendering component"
```

---

### Task 7: ToolCallBlock — Collapsible Tool Call Component

**Files:**
- Create: `packages/web/src/components/chat/tool-call-block.tsx`

- [ ] **Step 1: Create ToolCallBlock component**

Ported from cc-web's `createToolCallElement` and `buildToolContentElement`. Renders collapsible tool calls with status indicator, tool name, and content.

```tsx
// packages/web/src/components/chat/tool-call-block.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ToolCall } from '@/types/chat';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function toolTitle(tool: ToolCall): string {
  return tool.name || 'Tool';
}

function toolSubtitle(tool: ToolCall): string {
  if (tool.kind === 'command_execution') {
    try {
      const input = JSON.parse(tool.input);
      return input.command?.slice(0, 60) || '';
    } catch {
      return tool.input.slice(0, 60);
    }
  }
  if (tool.kind === 'file_change' || tool.kind === 'mcp_tool_call') {
    try {
      const input = JSON.parse(tool.input);
      return input.file_path || input.path || '';
    } catch {
      return '';
    }
  }
  return '';
}

function stateLabel(status: ToolCall['status']): string {
  switch (status) {
    case 'running': return '运行中';
    case 'completed': return '完成';
    case 'error': return '错误';
    default: return '';
  }
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [isOpen, setIsOpen] = useState(
    toolCall.name === 'AskUserQuestion' || (toolCall.status === 'running' && toolCall.kind === 'command_execution')
  );
  const subtitle = toolSubtitle(toolCall);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      className={cn(
        'tool-call rounded-lg border mb-2',
        toolCall.status === 'running' && 'border-[#5b7ea1]/40 bg-[#f5f0e8]',
        toolCall.status === 'completed' && 'border-[#ddd0c0] bg-[#faf6f0]',
        toolCall.status === 'error' && 'border-[#c0553a]/40 bg-[#f5ddd4]',
      )}
    >
      <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none text-[13px]">
        <span className={cn(
          'tool-call-icon w-2 h-2 rounded-full',
          toolCall.status === 'running' ? 'bg-[#5b7ea1] animate-pulse' : 'bg-[#5d8a54]',
        )} />
        <span className="tool-call-summary-main flex-1 min-w-0">
          <span className="tool-call-label font-semibold text-[#2d1f14]">{toolTitle(toolCall)}</span>
          {subtitle && <span className="tool-call-subtitle text-[#9a8b7d] ml-2 truncate">{subtitle}</span>}
        </span>
        <span className={cn(
          'tool-call-state text-xs px-1.5 py-0.5 rounded',
          toolCall.status === 'running' ? 'text-[#5b7ea1] bg-[#5b7ea1]/10' :
          toolCall.status === 'completed' ? 'text-[#5d8a54] bg-[#5d8a54]/10' :
          'text-[#c0553a] bg-[#c0553a]/10',
        )}>
          {stateLabel(toolCall.status)}
        </span>
      </summary>
      <div className="px-3 pb-3 text-[13px] text-[#2d1f14]">
        {toolCall.kind === 'command_execution' ? (
          <div className="space-y-2">
            <div>
              <span className="text-[#9a8b7d] text-xs">Command</span>
              <pre className="bg-[#eee8d5] rounded p-2 mt-1 text-[12px] overflow-x-auto font-mono whitespace-pre-wrap">
                {(() => {
                  try { return JSON.parse(toolCall.input).command || toolCall.input; } catch { return toolCall.input; }
                })()}
              </pre>
            </div>
            {toolCall.output && (
              <div>
                <span className="text-[#9a8b7d] text-xs">Output</span>
                <pre className="bg-[#eee8d5] rounded p-2 mt-1 text-[12px] overflow-x-auto font-mono whitespace-pre-wrap max-h-[200px]">
                  {toolCall.output}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <pre className="bg-[#eee8d5] rounded p-2 text-[12px] overflow-x-auto font-mono whitespace-pre-wrap">
            {(() => {
              try { return JSON.stringify(JSON.parse(toolCall.input), null, 2); } catch { return toolCall.input; }
            })()}
          </pre>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/chat/tool-call-block.tsx
git -C /home/lsx/code-link commit -m "feat: add ToolCallBlock collapsible component"
```

---

### Task 8: ChatInput — Message Input Area

**Files:**
- Create: `packages/web/src/components/chat/chat-input.tsx`
- Create: `packages/web/src/components/chat/slash-command-menu.tsx`
- Create: `packages/web/src/components/chat/attachment-tray.tsx`

- [ ] **Step 1: Create SlashCommandMenu component**

Ported from cc-web's `SLASH_COMMANDS` and `showCmdMenu`/`navigateCmdMenu`.

```tsx
// packages/web/src/components/chat/slash-command-menu.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

const SLASH_COMMANDS = [
  { cmd: '/clear', desc: '清除当前会话' },
  { cmd: '/model', desc: '查看/切换模型' },
  { cmd: '/mode', desc: '查看/切换权限模式' },
  { cmd: '/cost', desc: '查看会话费用' },
  { cmd: '/compact', desc: '压缩上下文' },
  { cmd: '/init', desc: '生成/更新 Agent 指南文件' },
];

interface SlashCommandMenuProps {
  filter: string;
  onSelect: (cmd: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ filter, onSelect, onClose }: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter(
    (c) => c.cmd.startsWith(filter) || c.desc.includes(filter.slice(1))
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex].cmd);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtered, activeIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    onClose();
    return null;
  }

  return (
    <div ref={menuRef} className="cmd-menu">
      {filtered.map((c, i) => (
        <div
          key={c.cmd}
          className={cn('cmd-item', i === activeIndex && 'active')}
          onClick={() => onSelect(c.cmd)}
        >
          <span className="cmd-item-cmd">{c.cmd}</span>
          <span className="cmd-item-desc">{c.desc}</span>
        </div>
      ))}
    </div>
  );
}

// cn utility import needed — add:
import { cn } from '@/lib/utils';
```

- [ ] **Step 2: Create AttachmentTray component**

```tsx
// packages/web/src/components/chat/attachment-tray.tsx
'use client';

import { useState, useRef } from 'react';
import type { Attachment } from '@/types/chat';

interface AttachmentTrayProps {
  attachments: Attachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  maxCount?: number;
}

export function AttachmentTray({ attachments, onAdd, onRemove, maxCount = 4 }: AttachmentTrayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => /^image\//.test(f.type || '')
    );
    if (attachments.length + files.length > maxCount) {
      alert(`单条消息最多附带 ${maxCount} 张图片`);
      return;
    }
    onAdd(files);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileSelect}
      />
      {attachments.length > 0 && (
        <div className="attachment-tray">
          {attachments.map((att) => (
            <div key={att.id} className="attachment-chip">
              <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover" />
              <span className="truncate max-w-[120px]">{att.name}</span>
              {att.status === 'error' && <span className="text-[#c0553a] text-xs">失败</span>}
              <span
                className="cursor-pointer text-[#9a8b7d] hover:text-[#c0553a] ml-1"
                onClick={() => onRemove(att.id)}
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      )}
      <button
        className="attach-btn"
        onClick={() => fileInputRef.current?.click()}
        title="添加图片"
      >
        📎
      </button>
    </>
  );
}
```

- [ ] **Step 3: Create ChatInput component (the main input area)**

Ported from cc-web's `sendMessage()`, `renderInput()`, and `autoResize()`. This replaces the old MessageEditor.

```tsx
// packages/web/src/components/chat/chat-input.tsx
'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { SlashCommandMenu } from './slash-command-menu';
import { AttachmentTray } from './attachment-tray';
import type { SelectedElement } from '@/types/claude-message';
import type { Attachment } from '@/types/chat';

interface ChatInputProps {
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSend: (message: string, elements: SelectedElement[], attachments: Attachment[]) => void;
  onAbort: () => void;
  isRunning: boolean;
}

export function ChatInput({ elements, onRemoveElement, onSend, onAbort, isRunning }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea (ported from cc-web autoResize)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // Show slash command menu when input starts with /
  const cmdFilter = text.startsWith('/') ? text : '';

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCmdMenu) return; // SlashCommandMenu handles its own keys

    if (e.key === 'Backspace' && text === '' && elements.length > 0) {
      onRemoveElement(elements[elements.length - 1].id);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && elements.length === 0 && attachments.length === 0) return;
    onSend(trimmed, elements, attachments);
    setText('');
    setAttachments([]);
  }, [text, elements, attachments, onSend]);

  const handleCmdSelect = useCallback((cmd: string) => {
    setShowCmdMenu(false);
    onSend(cmd, [], []);
  }, [onSend]);

  const handleAddFiles = useCallback((files: File[]) => {
    const newAttachments: Attachment[] = files.map((file, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'image' as const,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      status: 'pending' as const,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div className="chat-input-container relative bg-[#faf6f0]">
      {showCmdMenu && cmdFilter && (
        <SlashCommandMenu
          filter={cmdFilter}
          onSelect={handleCmdSelect}
          onClose={() => setShowCmdMenu(false)}
        />
      )}

      <AttachmentTray
        attachments={attachments}
        onAdd={handleAddFiles}
        onRemove={handleRemoveAttachment}
      />

      <div className="input-wrapper">
        {elements.map((el) => (
          <span key={el.id} className="element-tag">
            &lt;{el.tagName}&gt;
            <span className="remove" onClick={() => onRemoveElement(el.id)}>✕</span>
          </span>
        ))}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.startsWith('/')) {
              setShowCmdMenu(true);
            } else {
              setShowCmdMenu(false);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={elements.length > 0 ? '描述修改...' : '输入消息… 输入 / 查看指令'}
          rows={1}
          className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-[#2d1f14] text-[13px] placeholder:text-[#9a8b7d] resize-none py-2"
        />

        {isRunning ? (
          <button onClick={onAbort} className="send-btn w-[44px] h-[44px] rounded-xl bg-[#c0553a] text-white flex items-center justify-center">
            ⏹
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && elements.length === 0 && attachments.length === 0}
            className={cn(
              'send-btn w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-colors',
              text.trim() || elements.length > 0
                ? 'bg-[#c0553a] text-white'
                : 'bg-[#e9e0d4] text-[#9a8b7d]'
            )}
          >
            ➤
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/chat/chat-input.tsx packages/web/src/components/chat/slash-command-menu.tsx packages/web/src/components/chat/attachment-tray.tsx
git -C /home/lsx/code-link commit -m "feat: add ChatInput, SlashCommandMenu, and AttachmentTray components"
```

---

### Task 9: MessageList, MessageItem, WelcomeScreen, ChatHeader

**Files:**
- Create: `packages/web/src/components/chat/welcome-screen.tsx`
- Create: `packages/web/src/components/chat/message-item.tsx`
- Create: `packages/web/src/components/chat/message-list.tsx`
- Create: `packages/web/src/components/chat/chat-header.tsx`

- [ ] **Step 1: Create WelcomeScreen component**

```tsx
// packages/web/src/components/chat/welcome-screen.tsx
'use client';

export function WelcomeScreen() {
  return (
    <div className="welcome-msg flex flex-col items-center justify-center h-full text-center py-20">
      <div className="welcome-icon text-5xl mb-4 text-[#c0553a] opacity-60">✿</div>
      <h3 className="text-lg font-medium text-[#2d1f14] mb-2">欢迎使用 Code-Link</h3>
      <p className="text-sm text-[#9a8b7d]">开始与 Claude 对话</p>
    </div>
  );
}
```

- [ ] **Step 2: Create MessageItem component**

```tsx
// packages/web/src/components/chat/message-item.tsx
'use client';

import { cn } from '@/lib/utils';
import { AssistantMessage } from './assistant-message';
import { ToolCallBlock } from './tool-call-block';
import type { ChatMessage } from '@/types/chat';

interface MessageItemProps {
  message: ChatMessage;
  streamingContent?: string;
}

export function MessageItem({ message, streamingContent }: MessageItemProps) {
  if (message.role === 'tool' && message.toolCall) {
    return <ToolCallBlock toolCall={message.toolCall} />;
  }

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('msg flex gap-3 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className={cn(
          'msg-avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
          isAssistant ? 'bg-[#c0553a]/10 text-[#c0553a]' : 'bg-[#e9e0d4] text-[#2d1f14]'
        )}>
          C
        </div>
      )}

      <div className={cn(
        'msg-bubble max-w-[80%] px-3 py-2 rounded-2xl text-[13px]',
        isUser
          ? 'bg-[#c0553a] text-white rounded-br-md'
          : 'bg-[#fff9f2] text-[#2d1f14] border border-[#ddd0c0]/50 rounded-bl-md'
      )}>
        {isUser ? (
          <div className="msg-text whitespace-pre-wrap">
            {message.content}
            {message.elements && message.elements.length > 0 && (
              <div className="mt-1 text-xs opacity-80">
                {message.elements.map((el, i) => (
                  <span key={el.id} className="inline-block mr-1">&lt;{el.tagName}&gt;</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <AssistantMessage
            content={isAssistant && streamingContent ? streamingContent : message.content}
            isStreaming={isAssistant && !!streamingContent}
          />
        )}

        {message.cost && (
          <div className="text-xs text-[#9a8b7d] mt-1 pt-1 border-t border-[#ddd0c0]/30">
            Tokens: {message.cost.inputTokens} → {message.cost.outputTokens} · Cost: ${message.cost.totalCost.toFixed(4)}
          </div>
        )}
      </div>

      {isUser && (
        <div className="msg-avatar w-8 h-8 rounded-full bg-[#c0553a] text-white flex items-center justify-center text-xs font-semibold shrink-0">
          U
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create MessageList component**

```tsx
// packages/web/src/components/chat/message-list.tsx
'use client';

import { useRef, useEffect } from 'react';
import { WelcomeScreen } from './welcome-screen';
import { MessageItem } from './message-item';
import type { ChatMessage } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  isRunning: boolean;
}

export function MessageList({ messages, streamingContent, isRunning }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isRunning) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#faf6f0]">
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-[#faf6f0] px-4 py-3">
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          streamingContent={msg.role === 'assistant' && isRunning ? streamingContent : undefined}
        />
      ))}
      {/* Streaming indicator — partial assistant message being composed */}
      {isRunning && streamingContent && !messages.some((m) => m.role === 'assistant' && m.content === '') && (
        <MessageItem
          message={{
            id: 'streaming',
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          }}
          streamingContent={streamingContent}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create ChatHeader component**

```tsx
// packages/web/src/components/chat/chat-header.tsx
'use client';

import { cn } from '@/lib/utils';
import type { AgentType, PermissionMode } from '@/types/chat';
import type { Project } from '@/types';

interface ChatHeaderProps {
  project: Project | null;
  agent: AgentType;
  permissionMode: PermissionMode;
  onAgentChange: (agent: AgentType) => void;
  onModeChange: (mode: PermissionMode) => void;
  onRestart?: () => void;
}

const MODE_LABELS: Record<PermissionMode, string> = {
  default: 'Default',
  plan: 'Plan',
  yolo: 'YOLO',
};

const AGENT_LABELS: Record<AgentType, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

export function ChatHeader({ project, agent, permissionMode, onAgentChange, onModeChange, onRestart }: ChatHeaderProps) {
  const isRunning = project?.status === 'running';

  return (
    <div className="panel-header justify-between bg-[#f2ebe2] border-b border-[#ddd0c0]">
      <div className="flex items-center gap-2">
        <span className={cn(
          'status-dot',
          isRunning ? 'status-dot-running animate-pulse' : 'status-dot-stopped'
        )} />
        <span className="text-[#2d1f14] text-[13px] font-medium">{project?.name || '未选择项目'}</span>

        <button
          onClick={() => onAgentChange(agent === 'claude' ? 'codex' : 'claude')}
          className="chat-agent-btn px-2 py-1 rounded-md bg-[#e9e0d4] text-[#2d1f14] text-[12px] font-semibold hover:bg-[#ddd0c0] transition-colors"
        >
          {AGENT_LABELS[agent]}
        </button>

        <select
          value={permissionMode}
          onChange={(e) => onModeChange(e.target.value as PermissionMode)}
          className="mode-select px-2 py-1 rounded-md bg-[#e9e0d4] text-[#2d1f14] text-[12px] border border-[#ddd0c0] outline-none cursor-pointer"
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {onRestart && (
        <button
          onClick={onRestart}
          className="px-2.5 py-1 rounded-md bg-[#e9e0d4] text-[#2d1f14] text-[11px] hover:bg-[#ddd0c0] transition-colors"
        >
          重启
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/chat/welcome-screen.tsx packages/web/src/components/chat/message-item.tsx packages/web/src/components/chat/message-list.tsx packages/web/src/components/chat/chat-header.tsx
git -C /home/lsx/code-link commit -m "feat: add WelcomeScreen, MessageItem, MessageList, and ChatHeader components"
```

---

## Phase 3: Integration — ChatWorkspace, Workspace Wiring, Styles, Cleanup

### Task 10: ChatWorkspace — Main Container Component

**Files:**
- Create: `packages/web/src/components/chat/index.tsx`

- [ ] **Step 1: Create ChatWorkspace component**

This is the main container that replaces TerminalWorkspace. It wires the chat session reducer, socket events, and all child components together.

```tsx
// packages/web/src/components/chat/index.tsx
'use client';

import { useEffect, useCallback } from 'react';
import { ChatHeader } from './chat-header';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { useChatSession } from './chat-reducer';
import { useTerminalSocket } from '@/lib/socket/terminal';
import type { SelectedElement } from '@/types/claude-message';
import type { Attachment } from '@/types/chat';
import type { Project } from '@/types';

interface ChatWorkspaceProps {
  project: Project | null;
  userId: number;
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSendMessage?: (message: string, elements: SelectedElement[]) => void;
  onRestart?: () => void;
  onChatReady?: (sendFn: (elements: SelectedElement[], message: string) => void) => void;
}

export function ChatWorkspace({
  project,
  userId,
  elements,
  onRemoveElement,
  onSendMessage,
  onRestart,
  onChatReady,
}: ChatWorkspaceProps) {
  const {
    state,
    addUserMessage,
    startStreaming,
    appendStream,
    finishStream,
    addToolCall,
    updateToolCall,
    setRunning,
    setAgent,
    setPermissionMode,
    resetSession,
  } = useChatSession();

  const { isConnected, isStarted, start, sendClaudeMessage } = useTerminalSocket({
    projectId: project?.id ?? null,
    onClaudeStream: (text) => {
      appendStream(text);
    },
    onToolStart: (data) => {
      addToolCall({
        id: data.toolUseId,
        name: data.name,
        input: data.input,
        status: 'running',
        kind: data.kind,
      });
    },
    onToolEnd: (data) => {
      updateToolCall(data.toolUseId, data.result || '', 'completed');
    },
    onClaudeDone: (data) => {
      finishStream(state.streamingContent, data.cost);
    },
    onClaudeError: (message) => {
      finishStream(state.streamingContent);
    },
    onError: (message) => {
      setRunning(false);
    },
    onExit: () => {
      setRunning(false);
    },
  });

  // Start terminal session when project is running
  useEffect(() => {
    if (isConnected && !isStarted && project?.status === 'running') {
      start(80, 24);
    }
  }, [isConnected, isStarted, project?.status, start]);

  // Notify parent when chat is ready
  useEffect(() => {
    if (onChatReady && sendClaudeMessage) {
      onChatReady(sendClaudeMessage);
    }
  }, [onChatReady, sendClaudeMessage]);

  // Reset session when project changes
  useEffect(() => {
    if (project) {
      resetSession();
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    (message: string, els: SelectedElement[], attachments: Attachment[]) => {
      addUserMessage(message, els.length > 0 ? els : undefined, attachments.length > 0 ? attachments : undefined);
      if (sendClaudeMessage) {
        sendClaudeMessage(els, message, state.permissionMode, state.agent);
      }
      if (onSendMessage) {
        onSendMessage(message, els);
      }
    },
    [addUserMessage, sendClaudeMessage, state.permissionMode, state.agent, onSendMessage]
  );

  const handleAbort = useCallback(() => {
    // Emit kill event via socket
    if (isStarted) {
      // Use the existing kill mechanism
      setRunning(false);
    }
  }, [isStarted, setRunning]);

  if (!project) {
    return (
      <div className="panel-container items-center justify-center bg-[#faf6f0]">
        <div className="text-center">
          <div className="text-5xl mb-4 text-[#c0553a] opacity-30">✿</div>
          <div className="text-[#9a8b7d] text-sm">选择一个项目开始对话</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-container bg-[#faf6f0]">
      <ChatHeader
        project={project}
        agent={state.agent}
        permissionMode={state.permissionMode}
        onAgentChange={setAgent}
        onModeChange={setPermissionMode}
        onRestart={onRestart}
      />
      <MessageList
        messages={state.messages}
        streamingContent={state.streamingContent}
        isRunning={state.isRunning}
      />
      <ChatInput
        elements={elements}
        onRemoveElement={onRemoveElement}
        onSend={handleSend}
        onAbort={handleAbort}
        isRunning={state.isRunning}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/chat/index.tsx
git -C /home/lsx/code-link commit -m "feat: add ChatWorkspace main container component"
```

---

### Task 11: Wire ChatWorkspace into Workspace & Dashboard

**Files:**
- Modify: `packages/web/src/components/workspace/index.tsx`
- Modify: `packages/web/src/app/dashboard/page.tsx` (if needed)

- [ ] **Step 1: Update Workspace to use ChatWorkspace**

Replace the dynamic import of TerminalWorkspace with ChatWorkspace. The Workspace component coordinates the left/right panel linkage, so we need to update it to pass the right props.

Current `packages/web/src/components/workspace/index.tsx` uses:
```
const TerminalWorkspace = dynamic(() => import('@/components/terminal').then((m) => ({ default: m.TerminalWorkspace })), { loading: () => <Loading text="加载终端..." /> });
```

Replace with:

```tsx
const ChatWorkspace = dynamic(
  () => import('@/components/chat').then((m) => ({ default: m.ChatWorkspace })),
  { loading: () => <Loading text="加载聊天..." /> }
);
```

Update the JSX inside ResizableSplit from:
```tsx
<TerminalWorkspace
  project={project}
  userId={userId}
  wsUrl={wsUrl}
  elements={elements}
  onRemoveElement={handleRemoveElement}
  onSendMessage={handleSendMessage}
  onRestart={onRestart}
  onTerminalReady={handleTerminalReady}
/>
```

To:
```tsx
<ChatWorkspace
  project={project}
  userId={userId}
  elements={elements}
  onRemoveElement={handleRemoveElement}
  onSendMessage={handleSendMessage}
  onRestart={onRestart}
  onChatReady={handleTerminalReady}
/>
```

Note: `onTerminalReady` is renamed to `onChatReady` but the callback signature stays the same — it still receives `sendClaudeMessage` function. The `wsUrl` prop is no longer needed (handled by Socket.IO internally).

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/components/workspace/index.tsx
git -C /home/lsx/code-link commit -m "feat: wire ChatWorkspace into Workspace component"
```

---

### Task 12: Add Wasbi Theme Styles to globals.css

**Files:**
- Modify: `packages/web/src/styles/globals.css`

- [ ] **Step 1: Add washi-specific CSS classes**

The existing `globals.css` already has `.chat-input-container`, `.cmd-menu`, `.cmd-item`, `.attachment-tray`, `.attachment-chip`, `.input-wrapper`, `.attach-btn`, `.element-tag`, `.inline-input-container`, `.status-dot`, `.panel-container`, `.panel-header` classes. These are styled for the dark theme. We need to add washi overrides for the chat area.

Add these new classes inside `@layer components` in `globals.css`:

```css
  /* Wasabi theme — Chat area overrides */
  .chat-washi .panel-container {
    background-color: #faf6f0;
  }

  .chat-washi .panel-header {
    background-color: #f2ebe2;
    border-bottom-color: #ddd0c0;
  }

  .chat-washi .msg-bubble {
    border-radius: 16px;
  }

  .chat-washi .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .chat-washi .typing-indicator span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c0553a;
    animation: blink 1.4s infinite;
  }

  .chat-washi .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .chat-washi .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  .chat-washi .code-block-wrapper {
    margin: 8px 0;
    border-radius: 8px;
    overflow: hidden;
  }

  .chat-washi .code-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: #eee8d5;
    font-size: 12px;
    color: #6b5a4d;
  }

  .chat-washi .code-copy-btn {
    background: transparent;
    border: 1px solid #ddd0c0;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    color: #6b5a4d;
    font-size: 12px;
  }

  .chat-washi .code-copy-btn:hover {
    background: #e9e0d4;
  }

  .chat-washi .code-block-wrapper pre {
    background: #eee8d5;
    padding: 12px;
    margin: 0;
    border-radius: 0 0 8px 8px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
  }
```

Also add washi scrollbar styles inside `.chat-washi`:

```css
  .chat-washi ::-webkit-scrollbar-thumb {
    background: #c9baa9;
  }

  .chat-washi ::-webkit-scrollbar-thumb:hover {
    background: #ddd0c0;
  }
```

- [ ] **Step 2: Update ChatWorkspace to use chat-washi class**

In `packages/web/src/components/chat/index.tsx`, wrap the outer div with the washi theme class:

```tsx
<div className="panel-container chat-washi bg-[#faf6f0]">
```

This ensures all child components inherit washi theme overrides via CSS cascade.

- [ ] **Step 3: Commit**

```bash
git -C /home/lsx/code-link add packages/web/src/styles/globals.css packages/web/src/components/chat/index.tsx
git -C /home/lsx/code-link commit -m "style: add washi theme CSS overrides for chat area"
```

---

### Task 13: Remove Old Terminal Components

**Files:**
- Delete: `packages/web/src/components/terminal/index.tsx`
- Delete: `packages/web/src/components/terminal/terminal-panel.tsx`
- Delete: `packages/web/src/components/terminal/tab-bar.tsx`
- Delete: `packages/web/src/components/terminal/message-editor.tsx`

- [ ] **Step 1: Verify ChatWorkspace works before deleting**

Start the dev server and verify the chat UI renders correctly:

```bash
cd /home/lsx/code-link && pnpm --filter @code-link/web dev
```

Open http://localhost:3000/dashboard in browser. Check:
- ChatWorkspace renders with washi theme
- ChatHeader shows project name + agent/mode selectors
- ChatInput shows textarea + send button + slash command menu
- Right panel (CollaborationPanel) still works with element selection → chat input linkage
- No import errors for removed terminal components

- [ ] **Step 2: Delete terminal component files**

```bash
rm packages/web/src/components/terminal/index.tsx
rm packages/web/src/components/terminal/terminal-panel.tsx
rm packages/web/src/components/terminal/tab-bar.tsx
rm packages/web/src/components/terminal/message-editor.tsx
```

Check if the terminal directory has other files (test files, etc.):

```bash
ls packages/web/src/components/terminal/
```

If the directory is empty after deletions, remove it:

```bash
rmdir packages/web/src/components/terminal/
```

- [ ] **Step 3: Remove xterm.js dependencies from package.json**

The terminal workspace used `@xterm/xterm`, `@xterm/addon-fit`, and `@xterm/addon-web-links`. These are no longer needed:

```bash
cd /home/lsx/code-link && pnpm --filter @code-link/web remove @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

- [ ] **Step 4: Search for remaining references to deleted components**

```bash
grep -r "terminal-panel" packages/web/src/ --include="*.tsx" --include="*.ts"
grep -r "tab-bar" packages/web/src/ --include="*.tsx" --include="*.ts"
grep -r "message-editor" packages/web/src/ --include="*.tsx" --include="*.ts"
grep -r "TerminalWorkspace" packages/web/src/ --include="*.tsx" --include="*.ts"
grep -r "@xterm" packages/web/src/ --include="*.tsx" --include="*.ts"
```

If any references remain, remove or update them.

- [ ] **Step 5: Commit**

```bash
git -C /home/lsx/code-link add -A packages/web/src/components/terminal/ packages/web/package.json pnpm-lock.yaml
git -C /home/lsx/code-link commit -m "refactor: remove TerminalWorkspace and xterm dependencies"
```

---

### Task 14: End-to-End Verification & Final Commit

**Files:**
- None (verification only)

- [ ] **Step 1: Start dev server and do manual E2E test**

```bash
cd /home/lsx/code-link && pnpm --filter @code-link/web dev
```

Test checklist:
1. Dashboard loads without errors
2. Selecting a project in sidebar → ChatWorkspace shows project name
3. Sending a message in ChatInput → message appears in MessageList
4. Slash command menu opens when typing `/`
5. Agent toggle (Claude/Codex) works
6. Permission mode selector works
7. Right panel element selection → elements appear in ChatInput
8. Removing an element from ChatInput works
9. Wasabi theme renders correctly (米黄背景, 正确的色彩)
10. No console errors related to removed terminal components

- [ ] **Step 2: Check TypeScript compilation**

```bash
cd /home/lsx/code-link && pnpm --filter @code-link/web build
```

Should compile without errors.

- [ ] **Step 3: Final verification commit (if any fixes were needed)**

```bash
git -C /home/lsx/code-link add -A
git -C /home/lsx/code-link commit -m "fix: address E2E verification issues"
```