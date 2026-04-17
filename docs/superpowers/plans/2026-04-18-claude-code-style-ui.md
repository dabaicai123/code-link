# Claude Code 风格 UI 改造实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Code Link 前端界面改造为 Claude Code 桌面端风格，采用深色主题、侧边栏+左右分屏布局，支持元素选择与 Claude Code 协作。

**Architecture:** 创建全局 CSS 变量系统，侧边栏+主工作区（左终端+右协作面板），终端底部消息编辑区支持元素标签与文本交替。

**Tech Stack:** Next.js 14, React 18, CSS 变量, @xterm/xterm, iframe 展示, 元素选择器

---

## Task 1: 创建全局样式和 CSS 变量系统

**Files:**
- Create: `packages/web/src/styles/globals.css`

- [ ] **Step 1: 创建全局样式文件**

```css
/* packages/web/src/styles/globals.css */

:root {
  /* 背景色 */
  --bg-primary: #0d0d0d;
  --bg-secondary: #161616;
  --bg-card: #1f1f1f;
  --bg-hover: #2a2a2a;

  /* 边框色 */
  --border-color: #2a2a2a;
  --border-light: #3a3a3a;

  /* 强调色 */
  --accent-color: #7c3aed;
  --accent-hover: #6d28d9;
  --accent-light: #8b5cf6;

  /* 文本色 */
  --text-primary: #e0e0e0;
  --text-secondary: #8b8b8b;
  --text-disabled: #6b7280;

  /* 状态色 */
  --status-success: #4ade80;
  --status-warning: #facc15;
  --status-error: #f87171;

  /* 尺寸 */
  --sidebar-width: 250px;
  --status-bar-height: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* 字体 */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: Menlo, Monaco, 'Courier New', monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

#__next { height: 100%; }

a { color: var(--accent-color); text-decoration: none; }
a:hover { color: var(--accent-light); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background-color: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.btn-secondary {
  background-color: var(--bg-hover);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--border-light);
}

.input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
}

.input::placeholder { color: var(--text-disabled); }
.input:focus { outline: none; border-color: var(--accent-color); }

.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

/* 元素标签样式 */
.element-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--accent-color);
}

.element-tag .remove {
  color: var(--text-disabled);
  cursor: pointer;
  margin-left: 2px;
}

.element-tag .remove:hover {
  color: var(--status-error);
}

/* 滚动条 */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-light); }
```

- [ ] **Step 2: 更新根布局**

修改 `packages/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Code Link',
  description: '开发环境管理平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/styles/globals.css packages/web/src/app/layout.tsx
git -C /root/my/code-link commit -m "feat: add global CSS variables and dark theme styles"
```

---

## Task 2: 创建侧边栏组件

**Files:**
- Create: `packages/web/src/components/sidebar/index.tsx`
- Create: `packages/web/src/components/sidebar/project-card.tsx`
- Create: `packages/web/src/components/sidebar/user-section.tsx`

- [ ] **Step 1: 创建项目卡片组件**

创建 `packages/web/src/components/sidebar/project-card.tsx`:

```tsx
'use client';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

const TEMPLATE_LABELS: Record<Project['template_type'], string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  onClick?: () => void;
}

export function ProjectCard({ project, isActive, onClick }: ProjectCardProps) {
  const statusColor = {
    running: 'var(--status-success)',
    stopped: 'var(--status-warning)',
    created: 'var(--text-disabled)',
  }[project.status];

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
        border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        marginBottom: '6px',
        opacity: project.status === 'stopped' ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{project.name}</span>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor }} />
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
        {TEMPLATE_LABELS[project.template_type]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建用户区域组件**

创建 `packages/web/src/components/sidebar/user-section.tsx`:

```tsx
'use client';

interface User {
  id: string;
  email: string;
  name: string;
}

interface UserSectionProps {
  user: User;
  onLogout: () => void;
}

export function UserSection({ user, onLogout }: UserSectionProps) {
  return (
    <div
      style={{
        padding: '12px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          backgroundColor: 'var(--accent-color)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 500,
        }}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{user.name}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{user.email}</div>
      </div>
      <button
        onClick={onLogout}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
        title="退出登录"
      >
        ⚙️
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 创建侧边栏主组件**

创建 `packages/web/src/components/sidebar/index.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { api, ApiError } from '@/lib/api';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  created_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface SidebarProps {
  user: User;
  activeProjectId: number | null;
  onProjectSelect: (project: Project) => void;
  onCreateProject: () => void;
  onLogout: () => void;
}

export function Sidebar({ user, activeProjectId, onProjectSelect, onCreateProject, onLogout }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await api.get<Project[]>('/projects');
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const runningProjects = projects.filter((p) => p.status === 'running');
  const stoppedProjects = projects.filter((p) => p.status !== 'running');

  return (
    <div
      style={{
        width: 'var(--sidebar-width)',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>Code Link</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>v1.0.0</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <>
            {runningProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  运行中 ({runningProjects.length})
                </div>
                {runningProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    onClick={() => onProjectSelect(project)}
                  />
                ))}
              </div>
            )}

            {stoppedProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  已停止 ({stoppedProjects.length})
                </div>
                {stoppedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    onClick={() => onProjectSelect(project)}
                  />
                ))}
              </div>
            )}

            <button
              onClick={onCreateProject}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px dashed var(--border-light)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + 新建项目
            </button>
          </>
        )}
      </div>

      <UserSection user={user} onLogout={onLogout} />
    </div>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/
git -C /root/my/code-link commit -m "feat: add sidebar components with grouped project cards"
```

---

## Task 3: 创建终端组件

**Files:**
- Create: `packages/web/src/components/terminal/index.tsx`
- Create: `packages/web/src/components/terminal/tab-bar.tsx`
- Create: `packages/web/src/components/terminal/terminal-panel.tsx`
- Create: `packages/web/src/components/terminal/message-editor.tsx`

- [ ] **Step 1: 创建终端标签栏**

创建 `packages/web/src/components/terminal/tab-bar.tsx`:

```tsx
'use client';

interface TerminalTab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onNewTab }: TabBarProps) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          style={{
            padding: '6px 12px',
            color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '12px',
            borderBottom: activeTabId === tab.id ? '2px solid var(--accent-color)' : 'none',
            backgroundColor: activeTabId === tab.id ? 'var(--bg-secondary)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }} style={{ fontSize: '10px', opacity: 0.6 }}>✕</span>
          )}
        </div>
      ))}
      <div onClick={onNewTab} style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>+</div>
    </div>
  );
}
```

- [ ] **Step 2: 创建终端面板**

创建 `packages/web/src/components/terminal/terminal-panel.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalWebSocket } from '@/lib/terminal-websocket';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  projectId: string;
  userId: string;
  wsUrl?: string;
}

export function TerminalPanel({ projectId, userId, wsUrl = 'ws://localhost:3001/terminal' }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--font-mono)',
      theme: {
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        cursor: 'var(--status-success)',
        cursorAccent: 'var(--bg-primary)',
        selectionBackground: '#264f78',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => fitAddon.fit(), 0);

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!xtermRef.current) return;

    const ws = new TerminalWebSocket();
    wsRef.current = ws;

    ws.setOnConnected(() => {
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        ws.start(dims?.cols || 80, dims?.rows || 24);
      }
    });

    ws.setOnOutput((data) => xtermRef.current?.write(data));
    ws.setOnExit(() => xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n'));
    ws.setOnError((msg) => xtermRef.current?.write(`\r\n\x1b[31m[Error: ${msg}]\x1b[0m\r\n`));

    ws.connect(wsUrl, projectId, userId);

    const disposable = xtermRef.current.onData((data) => ws.sendInput(data));
    const pingInterval = setInterval(() => ws.ping(), 30000);

    return () => {
      clearInterval(pingInterval);
      disposable.dispose();
      ws.disconnect();
    };
  }, [projectId, userId, wsUrl]);

  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current) wsRef.current.resize(dims.cols, dims.rows);
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100%', width: '100%', backgroundColor: 'var(--bg-primary)' }} />;
}
```

- [ ] **Step 3: 创建消息编辑区**

创建 `packages/web/src/components/terminal/message-editor.tsx`:

```tsx
'use client';

import { useState, useRef, KeyboardEvent } from 'react';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
}

interface MessageEditorProps {
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSend: (message: string, elements: SelectedElement[]) => void;
}

export function MessageEditor({ elements, onRemoveElement, onSend }: MessageEditorProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && text === '' && elements.length > 0) {
      // 输入框为空时，Backspace 删除最后一个元素
      onRemoveElement(elements[elements.length - 1].id);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() || elements.length > 0) {
        onSend(text, elements);
        setText('');
      }
    }
  };

  const handleSend = () => {
    if (text.trim() || elements.length > 0) {
      onSend(text, elements);
      setText('');
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* 已添加的元素 */}
      {elements.length > 0 && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', minHeight: '36px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', lineHeight: 1.8 }}>
            {elements.map((el, index) => (
              <span key={el.id} className="element-tag">
                &lt;{el.tagName}&gt;
                <span className="remove" onClick={() => onRemoveElement(el.id)}>✕</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 输入框 */}
      <div style={{ padding: '8px 12px', display: 'flex', gap: '8px' }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述修改需求，回车发送..."
          className="input"
          style={{ flex: 1 }}
        />
        <button onClick={handleSend} className="btn btn-primary">发送</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建终端主组件**

创建 `packages/web/src/components/terminal/index.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { TabBar } from './tab-bar';
import { TerminalPanel } from './terminal-panel';
import { MessageEditor, SelectedElement } from './message-editor';

interface Project {
  id: number;
  name: string;
  status: 'created' | 'running' | 'stopped';
}

interface TerminalWorkspaceProps {
  project: Project | null;
  userId: string;
  wsUrl?: string;
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSendMessage: (message: string, elements: SelectedElement[]) => void;
  onRestart?: () => void;
}

export function TerminalWorkspace({
  project,
  userId,
  wsUrl,
  elements,
  onRemoveElement,
  onSendMessage,
  onRestart,
}: TerminalWorkspaceProps) {
  const [tabs, setTabs] = useState([{ id: 'terminal-1', label: '终端 1' }]);
  const [activeTabId, setActiveTabId] = useState('terminal-1');
  const [tabCounter, setTabCounter] = useState(1);

  const handleNewTab = useCallback(() => {
    const newId = `terminal-${tabCounter + 1}`;
    setTabs((prev) => [...prev, { id: newId, label: `终端 ${tabCounter + 1}` }]);
    setActiveTabId(newId);
    setTabCounter((prev) => prev + 1);
  }, [tabCounter]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  if (!project) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📁</div>
          <div>选择一个项目开始工作</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* 标题栏 */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: project.status === 'running' ? 'var(--status-success)' : 'var(--status-warning)', fontSize: '10px' }}>●</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{project.name} — 终端</span>
        </div>
        <button onClick={onRestart} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>重启</button>
      </div>

      {/* 标签栏 */}
      <TabBar tabs={tabs} activeTabId={activeTabId} onTabSelect={setActiveTabId} onTabClose={handleCloseTab} onNewTab={handleNewTab} />

      {/* 终端内容 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tabs.map((tab) => (
          <div key={tab.id} style={{ height: '100%', display: activeTabId === tab.id ? 'block' : 'none' }}>
            <TerminalPanel projectId={String(project.id)} userId={userId} wsUrl={wsUrl} />
          </div>
        ))}
      </div>

      {/* 消息编辑区 */}
      <MessageEditor elements={elements} onRemoveElement={onRemoveElement} onSend={onSendMessage} />
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/terminal/
git -C /root/my/code-link commit -m "feat: add terminal with multi-tab and message editor"
```

---

## Task 4: 创建协作面板（展示功能）

**Files:**
- Create: `packages/web/src/components/collaboration/index.tsx`
- Create: `packages/web/src/components/collaboration/display-panel.tsx`

- [ ] **Step 1: 创建展示面板**

创建 `packages/web/src/components/collaboration/display-panel.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
}

interface DisplayPanelProps {
  onAddElement: (element: SelectedElement) => void;
}

export function DisplayPanel({ onAddElement }: DisplayPanelProps) {
  const [url, setUrl] = useState('http://localhost:3000');
  const [selectMode, setSelectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleAddElement = () => {
    if (selectedElement) {
      onAddElement(selectedElement);
      setSelectedElement(null);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 地址栏 */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          />
        </div>
        <button onClick={handleRefresh} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>刷新</button>
        <button
          onClick={() => setSelectMode(!selectMode)}
          className="btn"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: selectMode ? 'rgba(248, 113, 113, 0.2)' : 'var(--accent-color)',
            border: selectMode ? '1px solid var(--status-error)' : 'none',
            color: selectMode ? 'var(--status-error)' : 'white',
          }}
        >
          {selectMode ? '✕ 取消选择' : '🎯 选择'}
        </button>
      </div>

      {/* 选择模式提示 */}
      {selectMode && (
        <div style={{ padding: '4px 12px', backgroundColor: 'rgba(124, 58, 237, 0.1)', borderBottom: '1px solid var(--accent-color)', fontSize: '11px', color: 'var(--accent-light)' }}>
          选择模式已开启，点击页面元素可添加到消息中
        </div>
      )}

      {/* 选中元素的操作按钮 */}
      {selectMode && selectedElement && (
        <div style={{ padding: '4px 12px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <button onClick={handleAddElement} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }}>
            + 添加
          </button>
        </div>
      )}

      {/* 预览区域 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={url}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建协作面板主组件**

创建 `packages/web/src/components/collaboration/index.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { DisplayPanel, SelectedElement } from './display-panel';

interface CollaborationPanelProps {
  onAddElement: (element: SelectedElement) => void;
}

type PanelType = 'display' | 'docs';

export function CollaborationPanel({ onAddElement }: CollaborationPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('display');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* 面板切换 */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>协作面板</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActivePanel('display')}
            className="btn"
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              backgroundColor: activePanel === 'display' ? 'var(--accent-color)' : 'var(--bg-hover)',
              color: activePanel === 'display' ? 'white' : 'var(--text-secondary)',
            }}
          >
            展示
          </button>
          <button
            onClick={() => setActivePanel('docs')}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            文档
          </button>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>+</button>
        </div>
      </div>

      {/* 面板内容 */}
      {activePanel === 'display' && <DisplayPanel onAddElement={onAddElement} />}
      {activePanel === 'docs' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          文档功能开发中...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/collaboration/
git -C /root/my/code-link commit -m "feat: add collaboration panel with display and element selection"
```

---

## Task 5: 创建主工作区（左右分屏）

**Files:**
- Create: `packages/web/src/components/workspace/index.tsx`
- Create: `packages/web/src/components/workspace/resizable-split.tsx`

- [ ] **Step 1: 创建可拖拽分隔线组件**

创建 `packages/web/src/components/workspace/resizable-split.tsx`:

```tsx
'use client';

import { useState, useRef, useCallback, ReactNode } from 'react';

interface ResizableSplitProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

export function ResizableSplit({ left, right, defaultLeftWidth = 55, minLeftWidth = 30, maxLeftWidth = 80 }: ResizableSplitProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    const clampedWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, newWidth));
    setLeftWidth(clampedWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 全局事件监听
  if (typeof window !== 'undefined') {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%' }}>
      {/* 左侧面板 */}
      <div style={{ width: `${leftWidth}%`, overflow: 'hidden' }}>{left}</div>

      {/* 分隔线 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '4px',
          backgroundColor: isDragging ? 'var(--accent-color)' : 'var(--border-color)',
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: isDragging ? 'none' : 'background-color 0.15s',
        }}
      >
        <div style={{ width: '2px', height: '32px', backgroundColor: 'var(--border-light)', borderRadius: '1px' }} />
      </div>

      {/* 右侧面板 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>{right}</div>
    </div>
  );
}
```

- [ ] **Step 2: 创建主工作区组件**

创建 `packages/web/src/components/workspace/index.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { TerminalWorkspace } from '@/components/terminal';
import { CollaborationPanel } from '@/components/collaboration';
import { ResizableSplit } from './resizable-split';
import { SelectedElement } from '@/components/collaboration/display-panel';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

interface WorkspaceProps {
  project: Project | null;
  userId: string;
  wsUrl?: string;
  onRestart?: () => void;
}

export function Workspace({ project, userId, wsUrl, onRestart }: WorkspaceProps) {
  const [elements, setElements] = useState<SelectedElement[]>([]);

  const handleAddElement = useCallback((element: SelectedElement) => {
    setElements((prev) => [...prev, element]);
  }, []);

  const handleRemoveElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
  }, []);

  const handleSendMessage = useCallback((message: string, els: SelectedElement[]) => {
    // TODO: 发送消息到 Claude Code
    console.log('Sending message:', { message, elements: els });
    setElements([]);
  }, []);

  return (
    <ResizableSplit
      left={
        <TerminalWorkspace
          project={project}
          userId={userId}
          wsUrl={wsUrl}
          elements={elements}
          onRemoveElement={handleRemoveElement}
          onSendMessage={handleSendMessage}
          onRestart={onRestart}
        />
      }
      right={<CollaborationPanel onAddElement={handleAddElement} />}
      defaultLeftWidth={55}
      minLeftWidth={30}
      maxLeftWidth={80}
    />
  );
}
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/workspace/
git -C /root/my/code-link commit -m "feat: add resizable split workspace with terminal and collaboration panels"
```

---

## Task 6: 改造登录/注册页

**Files:**
- Modify: `packages/web/src/components/auth-form.tsx`
- Modify: `packages/web/src/app/login/page.tsx`
- Modify: `packages/web/src/app/register/page.tsx`

- [ ] **Step 1: 重写认证表单组件**

完全替换 `packages/web/src/components/auth-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ width: '320px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Code Link</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>开发环境管理平台</div>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {error && <div style={{ padding: '12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

          <div style={{ marginBottom: '12px' }}>
            <input type="email" placeholder="邮箱地址" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '12px' }}>
              <input type="text" placeholder="用户名" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          {mode === 'login' ? (
            <>没有账户？ <Link href="/register" style={{ color: 'var(--accent-color)' }}>注册</Link></>
          ) : (
            <>已有账户？ <Link href="/login" style={{ color: 'var(--accent-color)' }}>登录</Link></>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新登录页和注册页**

`packages/web/src/app/login/page.tsx`:
```tsx
import { AuthForm } from '@/components/auth-form';
export default function LoginPage() { return <AuthForm mode="login" />; }
```

`packages/web/src/app/register/page.tsx`:
```tsx
import { AuthForm } from '@/components/auth-form';
export default function RegisterPage() { return <AuthForm mode="register" />; }
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/auth-form.tsx packages/web/src/app/login/page.tsx packages/web/src/app/register/page.tsx
git -C /root/my/code-link commit -m "feat: redesign auth pages with minimal centered dark theme"
```

---

## Task 7: 创建新的仪表盘页面

**Files:**
- Modify: `packages/web/src/app/dashboard/page.tsx`
- Modify: `packages/web/src/components/create-project-dialog.tsx`

- [ ] **Step 1: 重写仪表盘页面**

完全替换 `packages/web/src/app/dashboard/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Workspace } from '@/components/workspace';
import { CreateProjectDialog } from '@/components/create-project-dialog';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const handleLogout = () => { logout(); router.push('/login'); };

  if (authLoading || !user) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>加载中...</div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <Sidebar user={user} activeProjectId={activeProject?.id ?? null} onProjectSelect={setActiveProject} onCreateProject={() => setIsDialogOpen(true)} onLogout={handleLogout} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Workspace project={activeProject} userId={user.id} />
      </div>
      <CreateProjectDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSuccess={(project) => { setActiveProject(project); setIsDialogOpen(false); }} />
    </div>
  );
}
```

- [ ] **Step 2: 更新创建项目弹窗样式**

替换 `packages/web/src/components/create-project-dialog.tsx`（样式改为深色主题，具体代码略）

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/app/dashboard/page.tsx packages/web/src/components/create-project-dialog.tsx
git -C /root/my/code-link commit -m "feat: redesign dashboard with split-panel layout"
```

---

## Task 8: 清理旧组件

**Files:**
- Delete: `packages/web/src/components/project-card.tsx`
- Delete: `packages/web/src/components/terminal.tsx`
- Delete: `packages/web/src/components/terminal-container.tsx`
- Delete: `packages/web/src/components/build-status.tsx`
- Delete: `packages/web/src/components/preview-frame.tsx`
- Modify: `packages/web/src/app/page.tsx`

- [ ] **Step 1: 更新首页并删除旧组件**

```bash
# 更新首页
# 删除旧组件
rm packages/web/src/components/project-card.tsx packages/web/src/components/terminal.tsx packages/web/src/components/terminal-container.tsx packages/web/src/components/build-status.tsx packages/web/src/components/preview-frame.tsx
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "refactor: remove old components and update home page"
```

---

## Task 9: 验证和测试

- [ ] **Step 1: 启动开发服务器验证**

运行: `pnpm --filter @code-link/web dev`

- [ ] **Step 2: 运行测试**

运行: `pnpm --filter @code-link/web test`

- [ ] **Step 3: 构建**

运行: `pnpm --filter @code-link/web build`

---

## 文件变更摘要

| 操作 | 文件路径 |
|------|----------|
| Create | `packages/web/src/styles/globals.css` |
| Create | `packages/web/src/components/sidebar/index.tsx` |
| Create | `packages/web/src/components/sidebar/project-card.tsx` |
| Create | `packages/web/src/components/sidebar/user-section.tsx` |
| Create | `packages/web/src/components/terminal/index.tsx` |
| Create | `packages/web/src/components/terminal/tab-bar.tsx` |
| Create | `packages/web/src/components/terminal/terminal-panel.tsx` |
| Create | `packages/web/src/components/terminal/message-editor.tsx` |
| Create | `packages/web/src/components/collaboration/index.tsx` |
| Create | `packages/web/src/components/collaboration/display-panel.tsx` |
| Create | `packages/web/src/components/workspace/index.tsx` |
| Create | `packages/web/src/components/workspace/resizable-split.tsx` |
| Modify | `packages/web/src/app/layout.tsx` |
| Modify | `packages/web/src/app/page.tsx` |
| Modify | `packages/web/src/app/login/page.tsx` |
| Modify | `packages/web/src/app/register/page.tsx` |
| Modify | `packages/web/src/app/dashboard/page.tsx` |
| Modify | `packages/web/src/components/auth-form.tsx` |
| Modify | `packages/web/src/components/create-project-dialog.tsx` |
| Delete | `packages/web/src/components/project-card.tsx` |
| Delete | `packages/web/src/components/terminal.tsx` |
| Delete | `packages/web/src/components/terminal-container.tsx` |
| Delete | `packages/web/src/components/build-status.tsx` |
| Delete | `packages/web/src/components/preview-frame.tsx` |
