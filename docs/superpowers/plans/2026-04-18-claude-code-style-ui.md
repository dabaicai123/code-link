# Claude Code 风格 UI 改造实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Code Link 前端界面改造为 Claude Code 桌面端风格，采用深色主题、分栏布局和极简主义设计。

**Architecture:** 创建全局 CSS 变量系统，重构布局为侧边栏+主工作区结构，改造登录页为极简中心式，实现多标签终端+预览切换的工作区。

**Tech Stack:** Next.js 14, React 18, CSS 变量, @xterm/xterm, iframe 预览

---

## Task 1: 创建全局样式和 CSS 变量系统

**Files:**
- Create: `packages/web/src/styles/globals.css`

- [ ] **Step 1: 创建全局样式文件**

```css
/* packages/web/src/styles/globals.css */

/* CSS 变量定义 */
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
  --header-height: 48px;
  --status-bar-height: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* 字体 */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: Menlo, Monaco, 'Courier New', monospace;
}

/* 全局重置 */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#__next {
  height: 100%;
}

/* 链接样式 */
a {
  color: var(--accent-color);
  text-decoration: none;
}

a:hover {
  color: var(--accent-light);
}

/* 按钮基础样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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

.btn-ghost {
  background-color: transparent;
  border: 1px dashed var(--border-light);
  color: var(--text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  border-color: var(--text-secondary);
  color: var(--text-primary);
}

/* 输入框样式 */
.input {
  width: 100%;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: border-color 0.15s ease;
}

.input::placeholder {
  color: var(--text-disabled);
}

.input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.input-error {
  border-color: var(--status-error);
}

/* 卡片样式 */
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

.card-hover:hover {
  border-color: var(--border-light);
  cursor: pointer;
}

/* 状态指示灯 */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-running {
  background-color: var(--status-success);
}

.status-stopped {
  background-color: var(--status-warning);
}

.status-created {
  background-color: var(--text-disabled);
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-light);
}

/* 错误消息样式 */
.error-message {
  padding: 12px;
  background-color: rgba(248, 113, 113, 0.1);
  border: 1px solid var(--status-error);
  border-radius: var(--radius-md);
  color: var(--status-error);
  font-size: 13px;
}
```

- [ ] **Step 2: 更新根布局引入全局样式**

修改 `packages/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Code Link',
  description: '开发环境管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 验证样式生效**

运行: `pnpm --filter @code-link/web dev`

检查: 打开 http://localhost:3000，确认深色背景生效

- [ ] **Step 4: 提交**

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
  const statusClass = {
    running: 'status-running',
    stopped: 'status-stopped',
    created: 'status-created',
  }[project.status];

  const opacityStyle = project.status === 'stopped' ? { opacity: 0.7 } : {};

  return (
    <div
      className={`card card-hover ${isActive ? 'border-[var(--accent-color)]' : ''}`}
      style={opacityStyle}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
          {project.name}
        </span>
        <span className={`status-dot ${statusClass}`} />
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
        <div
          style={{
            color: 'var(--text-primary)',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.name}
        </div>
        <div
          style={{
            color: 'var(--text-secondary)',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.email}
        </div>
      </div>
      <button
        onClick={onLogout}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '4px',
        }}
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

export function Sidebar({
  user,
  activeProjectId,
  onProjectSelect,
  onCreateProject,
  onLogout,
}: SidebarProps) {
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
      {/* 标题区 */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>
          Code Link
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
          v1.0.0
        </div>
      </div>

      {/* 项目列表 */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
            加载中...
          </div>
        ) : (
          <>
            {/* 运行中的项目 */}
            {runningProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}
                >
                  运行中 ({runningProjects.length})
                </div>
                {runningProjects.map((project) => (
                  <div key={project.id} style={{ marginBottom: '6px' }}>
                    <ProjectCard
                      project={project}
                      isActive={activeProjectId === project.id}
                      onClick={() => onProjectSelect(project)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 已停止的项目 */}
            {stoppedProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}
                >
                  已停止 ({stoppedProjects.length})
                </div>
                {stoppedProjects.map((project) => (
                  <div key={project.id} style={{ marginBottom: '6px' }}>
                    <ProjectCard
                      project={project}
                      isActive={activeProjectId === project.id}
                      onClick={() => onProjectSelect(project)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 新建项目按钮 */}
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={onCreateProject}
            >
              + 新建项目
            </button>
          </>
        )}
      </div>

      {/* 用户区域 */}
      <UserSection user={user} onLogout={onLogout} />
    </div>
  );
}
```

- [ ] **Step 4: 创建组件导出索引**

创建 `packages/web/src/components/sidebar/sidebar.types.ts`:

```tsx
export interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}
```

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/
git -C /root/my/code-link commit -m "feat: add sidebar components with grouped project cards"
```

---

## Task 3: 创建多标签终端组件

**Files:**
- Create: `packages/web/src/components/terminal-workspace/index.tsx`
- Create: `packages/web/src/components/terminal-workspace/tab-bar.tsx`
- Create: `packages/web/src/components/terminal-workspace/status-bar.tsx`
- Create: `packages/web/src/components/terminal-workspace/terminal-panel.tsx`

- [ ] **Step 1: 创建标签栏组件**

创建 `packages/web/src/components/terminal-workspace/tab-bar.tsx`:

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
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            padding: '8px 16px',
            color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '12px',
            borderBottom: activeTabId === tab.id ? '2px solid var(--accent-color)' : 'none',
            backgroundColor: activeTabId === tab.id ? 'var(--bg-secondary)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onClick={() => onTabSelect(tab.id)}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span
              style={{
                fontSize: '10px',
                opacity: 0.6,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              ✕
            </span>
          )}
        </div>
      ))}
      <div
        style={{
          padding: '8px 16px',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
        onClick={onNewTab}
      >
        +
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建状态栏组件**

创建 `packages/web/src/components/terminal-workspace/status-bar.tsx`:

```tsx
'use client';

interface StatusBarProps {
  project: {
    name: string;
    template_type: string;
  } | null;
  terminalInfo?: {
    nodeVersion?: string;
    npmVersion?: string;
    memory?: string;
  };
}

export function StatusBar({ project, terminalInfo }: StatusBarProps) {
  return (
    <div
      style={{
        padding: '6px 16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        gap: '16px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        height: 'var(--status-bar-height)',
      }}
    >
      {terminalInfo?.nodeVersion && <span>Node {terminalInfo.nodeVersion}</span>}
      {terminalInfo?.npmVersion && <span>npm {terminalInfo.npmVersion}</span>}
      {terminalInfo?.memory && <span>内存: {terminalInfo.memory}</span>}
    </div>
  );
}
```

- [ ] **Step 3: 创建终端面板组件**

创建 `packages/web/src/components/terminal-workspace/terminal-panel.tsx`:

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalWebSocket } from '@/lib/terminal-websocket';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  projectId: string;
  userId: string;
  wsUrl?: string;
  onExit?: () => void;
  onError?: (error: string) => void;
}

export function TerminalPanel({
  projectId,
  userId,
  wsUrl = 'ws://localhost:3001/terminal',
  onExit,
  onError,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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
        if (dims) {
          ws.start(dims.cols, dims.rows);
        } else {
          ws.start(80, 24);
        }
      }
    });

    ws.setOnOutput((data) => {
      xtermRef.current?.write(data);
    });

    ws.setOnExit(() => {
      xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
      onExit?.();
    });

    ws.setOnError((message) => {
      xtermRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`);
      onError?.(message);
    });

    ws.connect(wsUrl, projectId, userId);

    const disposable = xtermRef.current.onData((data) => {
      ws.sendInput(data);
    });

    const pingInterval = setInterval(() => ws.ping(), 30000);

    return () => {
      clearInterval(pingInterval);
      disposable.dispose();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [projectId, userId, wsUrl, onExit, onError]);

  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current) {
          wsRef.current.resize(dims.cols, dims.rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    resizeObserverRef.current = resizeObserver;

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
      }}
    />
  );
}
```

- [ ] **Step 4: 创建终端工作区主组件**

创建 `packages/web/src/components/terminal-workspace/index.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { TabBar } from './tab-bar';
import { StatusBar } from './status-bar';
import { TerminalPanel } from './terminal-panel';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

interface TerminalTab {
  id: string;
  label: string;
}

interface TerminalWorkspaceProps {
  project: Project | null;
  userId: string;
  wsUrl?: string;
  onRestart?: () => void;
}

export function TerminalWorkspace({
  project,
  userId,
  wsUrl = 'ws://localhost:3001/terminal',
  onRestart,
}: TerminalWorkspaceProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'terminal-1', label: '终端 1' },
  ]);
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

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  if (!project) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📁</div>
        <div>选择一个项目开始工作</div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* 工具栏 */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              color: project.status === 'running' ? 'var(--status-success)' : 'var(--status-warning)',
              fontSize: '10px',
            }}
          >
            ●
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
            {project.name} — /workspace
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            onClick={onRestart}
          >
            重启容器
          </button>
        </div>
      </div>

      {/* 标签栏 */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleSelectTab}
        onTabClose={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {/* 终端内容 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              height: '100%',
              display: activeTabId === tab.id ? 'block' : 'none',
            }}
          >
            <TerminalPanel
              projectId={String(project.id)}
              userId={userId}
              wsUrl={wsUrl}
            />
          </div>
        ))}
      </div>

      {/* 状态栏 */}
      <StatusBar project={project} />
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/terminal-workspace/
git -C /root/my/code-link commit -m "feat: add multi-tab terminal workspace component"
```

---

## Task 4: 创建预览面板组件

**Files:**
- Create: `packages/web/src/components/workspace/preview-panel.tsx`

- [ ] **Step 1: 创建预览面板组件**

创建 `packages/web/src/components/workspace/preview-panel.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBuild } from '@/hooks/use-build';

interface PreviewPanelProps {
  projectId: number;
}

const STATUS_LABELS = {
  pending: '等待中',
  running: '构建中',
  success: '成功',
  failed: '失败',
} as const;

const STATUS_COLORS = {
  pending: 'var(--status-warning)',
  running: 'var(--accent-color)',
  success: 'var(--status-success)',
  failed: 'var(--status-error)',
} as const;

export function PreviewPanel({ projectId }: PreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { loading, error, startBuild, getPreviewUrl, stopPreview } = useBuild(projectId);
  const [buildStatus, setBuildStatus] = useState<'pending' | 'running' | 'success' | 'failed' | null>(null);

  const handleStartBuild = async () => {
    setBuildStatus('running');
    const result = await startBuild();
    if (result) {
      const url = await getPreviewUrl();
      if (url) {
        setPreviewUrl(url);
        setBuildStatus('success');
      }
    } else {
      setBuildStatus('failed');
    }
  };

  const loadPreview = useCallback(async () => {
    const url = await getPreviewUrl();
    if (url) {
      setPreviewUrl(url);
      setBuildStatus('success');
    }
  }, [getPreviewUrl]);

  const handleStopPreview = async () => {
    const success = await stopPreview();
    if (success) {
      setPreviewUrl(null);
      setBuildStatus(null);
    }
  };

  const handleRefresh = () => {
    if (previewUrl) {
      // 通过添加时间戳强制刷新 iframe
      setPreviewUrl(`${previewUrl.split('?')[0]}?t=${Date.now()}`);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [projectId, loadPreview]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* 工具栏 */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <button
          onClick={handleStartBuild}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          {loading ? '构建中...' : '构建预览'}
        </button>
        {previewUrl && (
          <>
            <button
              onClick={handleRefresh}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              刷新
            </button>
            <button
              onClick={handleStopPreview}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                color: 'var(--status-error)',
                borderColor: 'var(--status-error)',
              }}
            >
              停止
            </button>
          </>
        )}
        {buildStatus && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: STATUS_COLORS[buildStatus],
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: STATUS_COLORS[buildStatus],
              }}
            />
            {STATUS_LABELS[buildStatus]}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            borderBottom: '1px solid var(--status-error)',
            color: 'var(--status-error)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* 预览区域 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {previewUrl ? (
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: 'white',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🌐</div>
            <div>点击「构建预览」开始</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/workspace/preview-panel.tsx
git -C /root/my/code-link commit -m "feat: add preview panel component with build controls"
```

---

## Task 5: 重构工作区支持终端/预览切换

**Files:**
- Create: `packages/web/src/components/workspace/index.tsx`
- Create: `packages/web/src/components/workspace/tab-bar.tsx`
- Create: `packages/web/src/components/workspace/status-bar.tsx`
- Create: `packages/web/src/components/workspace/terminal-panel.tsx`
- Create: `packages/web/src/components/workspace/workspace-switcher.tsx`

- [ ] **Step 1: 创建工作区切换组件**

创建 `packages/web/src/components/workspace/workspace-switcher.tsx`:

```tsx
'use client';

interface WorkspaceSwitcherProps {
  activeMode: 'terminal' | 'preview';
  onSwitch: (mode: 'terminal' | 'preview') => void;
}

export function WorkspaceSwitcher({ activeMode, onSwitch }: WorkspaceSwitcherProps) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <button
        onClick={() => onSwitch('terminal')}
        style={{
          padding: '10px 20px',
          backgroundColor: activeMode === 'terminal' ? 'var(--bg-primary)' : 'transparent',
          color: activeMode === 'terminal' ? 'var(--text-primary)' : 'var(--text-secondary)',
          border: 'none',
          borderBottom: activeMode === 'terminal' ? '2px solid var(--accent-color)' : 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        终端
      </button>
      <button
        onClick={() => onSwitch('preview')}
        style={{
          padding: '10px 20px',
          backgroundColor: activeMode === 'preview' ? 'var(--bg-primary)' : 'transparent',
          color: activeMode === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
          border: 'none',
          borderBottom: activeMode === 'preview' ? '2px solid var(--accent-color)' : 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        预览
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 创建终端标签栏组件**

创建 `packages/web/src/components/workspace/tab-bar.tsx`:

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
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
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
          onClick={() => onTabSelect(tab.id)}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span
              style={{
                fontSize: '10px',
                opacity: 0.6,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              ✕
            </span>
          )}
        </div>
      ))}
      <div
        style={{
          padding: '6px 12px',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
        onClick={onNewTab}
      >
        +
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建状态栏组件**

创建 `packages/web/src/components/workspace/status-bar.tsx`:

```tsx
'use client';

interface StatusBarProps {
  terminalInfo?: {
    nodeVersion?: string;
    npmVersion?: string;
    memory?: string;
  };
  previewInfo?: {
    port?: number;
    status?: string;
  };
}

export function StatusBar({ terminalInfo, previewInfo }: StatusBarProps) {
  return (
    <div
      style={{
        padding: '4px 16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        gap: '16px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        height: 'var(--status-bar-height)',
      }}
    >
      {terminalInfo?.nodeVersion && <span>Node {terminalInfo.nodeVersion}</span>}
      {terminalInfo?.npmVersion && <span>npm {terminalInfo.npmVersion}</span>}
      {terminalInfo?.memory && <span>内存: {terminalInfo.memory}</span>}
      {previewInfo?.port && <span>端口: {previewInfo.port}</span>}
    </div>
  );
}
```

- [ ] **Step 4: 创建终端面板组件**

创建 `packages/web/src/components/workspace/terminal-panel.tsx`:

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
  onExit?: () => void;
  onError?: (error: string) => void;
}

export function TerminalPanel({
  projectId,
  userId,
  wsUrl = 'ws://localhost:3001/terminal',
  onExit,
  onError,
}: TerminalPanelProps) {
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
        if (dims) {
          ws.start(dims.cols, dims.rows);
        } else {
          ws.start(80, 24);
        }
      }
    });

    ws.setOnOutput((data) => {
      xtermRef.current?.write(data);
    });

    ws.setOnExit(() => {
      xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
      onExit?.();
    });

    ws.setOnError((message) => {
      xtermRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`);
      onError?.(message);
    });

    ws.connect(wsUrl, projectId, userId);

    const disposable = xtermRef.current.onData((data) => {
      ws.sendInput(data);
    });

    const pingInterval = setInterval(() => ws.ping(), 30000);

    return () => {
      clearInterval(pingInterval);
      disposable.dispose();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [projectId, userId, wsUrl, onExit, onError]);

  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current) {
          wsRef.current.resize(dims.cols, dims.rows);
        }
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

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
      }}
    />
  );
}
```

- [ ] **Step 5: 创建工作区主组件**

创建 `packages/web/src/components/workspace/index.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { TabBar } from './tab-bar';
import { StatusBar } from './status-bar';
import { TerminalPanel } from './terminal-panel';
import { PreviewPanel } from './preview-panel';
import { WorkspaceSwitcher } from './workspace-switcher';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

interface TerminalTab {
  id: string;
  label: string;
}

interface WorkspaceProps {
  project: Project | null;
  userId: string;
  wsUrl?: string;
  onRestart?: () => void;
}

export function Workspace({
  project,
  userId,
  wsUrl = 'ws://localhost:3001/terminal',
  onRestart,
}: WorkspaceProps) {
  const [mode, setMode] = useState<'terminal' | 'preview'>('terminal');
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'terminal-1', label: '终端 1' },
  ]);
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

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  if (!project) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📁</div>
        <div>选择一个项目开始工作</div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* 项目标题栏 */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              color: project.status === 'running' ? 'var(--status-success)' : 'var(--status-warning)',
              fontSize: '10px',
            }}
          >
            ●
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
            {project.name}
          </span>
        </div>
        {mode === 'terminal' && (
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            onClick={onRestart}
          >
            重启容器
          </button>
        )}
      </div>

      {/* 工作区切换 */}
      <WorkspaceSwitcher activeMode={mode} onSwitch={setMode} />

      {/* 终端模式 */}
      {mode === 'terminal' && (
        <>
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleSelectTab}
            onTabClose={handleCloseTab}
            onNewTab={handleNewTab}
          />
          <div style={{ flex: 1, minHeight: 0 }}>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{
                  height: '100%',
                  display: activeTabId === tab.id ? 'block' : 'none',
                }}
              >
                <TerminalPanel
                  projectId={String(project.id)}
                  userId={userId}
                  wsUrl={wsUrl}
                />
              </div>
            ))}
          </div>
          <StatusBar />
        </>
      )}

      {/* 预览模式 */}
      {mode === 'preview' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <PreviewPanel projectId={project.id} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/workspace/
git -C /root/my/code-link commit -m "feat: add workspace with terminal/preview switching"
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

interface FormErrors {
  email?: string;
  name?: string;
  password?: string;
  general?: string;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (mode === 'register') {
      if (!name) {
        newErrors.name = '请输入用户名';
      } else if (name.length < 3) {
        newErrors.name = '用户名至少需要 3 个字符';
      } else if (name.length > 20) {
        newErrors.name = '用户名不能超过 20 个字符';
      } else if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        newErrors.name = '用户名只能包含字母、数字和下划线';
      }
    }

    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码至少需要 6 个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败，请稍后重试';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div style={{ width: '320px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Code Link
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
          开发环境管理平台
        </div>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {errors.general && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {errors.general}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              className={`input ${errors.email ? 'input-error' : ''}`}
            />
            {errors.email && (
              <div style={{ color: 'var(--status-error)', fontSize: '12px', marginTop: '4px' }}>
                {errors.email}
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="用户名"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError('name');
                }}
                className={`input ${errors.name ? 'input-error' : ''}`}
              />
              {errors.name && (
                <div style={{ color: 'var(--status-error)', fontSize: '12px', marginTop: '4px' }}>
                  {errors.name}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              className={`input ${errors.password ? 'input-error' : ''}`}
            />
            {errors.password && (
              <div style={{ color: 'var(--status-error)', fontSize: '12px', marginTop: '4px' }}>
                {errors.password}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            {isSubmitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          {mode === 'login' ? (
            <>
              没有账户？{' '}
              <Link href="/register" style={{ color: 'var(--accent-color)' }}>
                注册
              </Link>
            </>
          ) : (
            <>
              已有账户？{' '}
              <Link href="/login" style={{ color: 'var(--accent-color)' }}>
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新登录页**

替换 `packages/web/src/app/login/page.tsx`:

```tsx
import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
```

- [ ] **Step 3: 更新注册页**

替换 `packages/web/src/app/register/page.tsx`:

```tsx
import { AuthForm } from '@/components/auth-form';

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
```

- [ ] **Step 4: 提交**

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
import { TerminalWorkspace } from '@/components/terminal-workspace';
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
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleProjectSelect = (project: Project) => {
    setActiveProject(project);
  };

  const handleCreateProject = () => {
    setIsDialogOpen(true);
  };

  const handleProjectCreated = (project: Project) => {
    setActiveProject(project);
    setIsDialogOpen(false);
  };

  if (authLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        加载中...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* 侧边栏 */}
      <Sidebar
        user={user}
        activeProjectId={activeProject?.id ?? null}
        onProjectSelect={handleProjectSelect}
        onCreateProject={handleCreateProject}
        onLogout={handleLogout}
      />

      {/* 主工作区 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <TerminalWorkspace
          project={activeProject}
          userId={user.id}
        />
      </div>

      {/* 创建项目弹窗 */}
      <CreateProjectDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
```

- [ ] **Step 2: 更新创建项目弹窗样式**

替换 `packages/web/src/components/create-project-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

type TemplateType = 'node' | 'node+java' | 'node+python';

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  { value: 'node', label: 'Node.js', description: '纯 Node.js 运行环境' },
  { value: 'node+java', label: 'Node.js + Java', description: 'Node.js 与 Java 混合环境' },
  { value: 'node+python', label: 'Node.js + Python', description: 'Node.js 与 Python 混合环境' },
];

interface Project {
  id: number;
  name: string;
  template_type: TemplateType;
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  github_repo: string | null;
  created_by: number;
  created_at: string;
}

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

interface FormErrors {
  name?: string;
  template_type?: string;
  github_repo?: string;
  general?: string;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('node');
  const [githubRepo, setGithubRepo] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = '请输入项目名称';
    } else if (name.length > 100) {
      newErrors.name = '项目名称不能超过 100 个字符';
    }

    if (githubRepo && !/^https?:\/\/github\.com\/[\w-]+\/[\w.-]+$/.test(githubRepo)) {
      newErrors.github_repo = '请输入有效的 GitHub 仓库地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const project = await api.post<Project>('/projects', {
        name: name.trim(),
        template_type: templateType,
        ...(githubRepo && { github_repo: githubRepo.trim() }),
      });
      onSuccess(project);
      handleClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '创建项目失败，请稍后重试';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setTemplateType('node');
    setGithubRepo('');
    setErrors({});
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        }}
        onClick={handleClose}
      />

      {/* 对话框 */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          width: '400px',
          maxWidth: '90vw',
          padding: '24px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>
            创建新项目
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {errors.general}
            </div>
          )}

          {/* 项目名称 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              项目名称 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="输入项目名称"
            />
            {errors.name && (
              <div style={{ color: 'var(--status-error)', fontSize: '12px', marginTop: '4px' }}>
                {errors.name}
              </div>
            )}
          </div>

          {/* 模板类型 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              模板类型 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TEMPLATE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: `1px solid ${templateType === option.value ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: templateType === option.value ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="template-type"
                    value={option.value}
                    checked={templateType === option.value}
                    onChange={() => setTemplateType(option.value)}
                    style={{ marginRight: '12px', accentColor: 'var(--accent-color)' }}
                  />
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{option.label}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* GitHub 仓库 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              GitHub 仓库 <span style={{ color: 'var(--text-disabled)' }}>(可选)</span>
            </label>
            <input
              type="url"
              value={githubRepo}
              onChange={(e) => {
                setGithubRepo(e.target.value);
                if (errors.github_repo) setErrors((prev) => ({ ...prev, github_repo: undefined }));
              }}
              className={`input ${errors.github_repo ? 'input-error' : ''}`}
              placeholder="https://github.com/owner/repo"
            />
            {errors.github_repo && (
              <div style={{ color: 'var(--status-error)', fontSize: '12px', marginTop: '4px' }}>
                {errors.github_repo}
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? '创建中...' : '创建项目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/app/dashboard/page.tsx packages/web/src/components/create-project-dialog.tsx
git -C /root/my/code-link commit -m "feat: redesign dashboard with split-panel layout and dark theme"
```

---

## Task 8: 清理旧组件和更新路由

**Files:**
- Delete: `packages/web/src/components/project-card.tsx` (旧版)
- Delete: `packages/web/src/components/terminal.tsx` (旧版，已被 terminal-panel 替代)
- Delete: `packages/web/src/components/terminal-container.tsx` (旧版)
- Modify: `packages/web/src/app/page.tsx`

- [ ] **Step 1: 更新首页重定向**

替换 `packages/web/src/app/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        加载中...
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: 删除旧组件**

```bash
rm packages/web/src/components/project-card.tsx
rm packages/web/src/components/terminal.tsx
rm packages/web/src/components/terminal-container.tsx
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "refactor: remove old components and update home page"
```

---

## Task 9: 验证和测试

**Files:**
- 无新文件

- [ ] **Step 1: 启动开发服务器验证**

运行: `pnpm --filter @code-link/web dev`

检查:
1. 访问 http://localhost:3000/login，确认深色登录页
2. 登录后确认侧边栏和主工作区布局
3. 点击项目卡片，确认终端显示
4. 测试多标签终端功能
5. 测试创建项目弹窗

- [ ] **Step 2: 运行现有测试**

运行: `pnpm --filter @code-link/web test`

修复任何失败的测试

- [ ] **Step 3: 构建验证**

运行: `pnpm --filter @code-link/web build`

确认构建成功无错误

- [ ] **Step 4: 最终提交**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "chore: verify UI overhaul completion"
```

---

## 文件变更摘要

| 操作 | 文件路径 |
|------|----------|
| Create | `packages/web/src/styles/globals.css` |
| Create | `packages/web/src/components/sidebar/index.tsx` |
| Create | `packages/web/src/components/sidebar/project-card.tsx` |
| Create | `packages/web/src/components/sidebar/user-section.tsx` |
| Create | `packages/web/src/components/sidebar/sidebar.types.ts` |
| Create | `packages/web/src/components/workspace/index.tsx` |
| Create | `packages/web/src/components/workspace/tab-bar.tsx` |
| Create | `packages/web/src/components/workspace/status-bar.tsx` |
| Create | `packages/web/src/components/workspace/terminal-panel.tsx` |
| Create | `packages/web/src/components/workspace/preview-panel.tsx` |
| Create | `packages/web/src/components/workspace/workspace-switcher.tsx` |
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
| Delete | `packages/web/src/components/build-status.tsx` (合并到 preview-panel) |
| Delete | `packages/web/src/components/preview-frame.tsx` (合并到 preview-panel) |

