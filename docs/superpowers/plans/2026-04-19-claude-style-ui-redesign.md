# Claude Style UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端 UI 从冷色调科技风改为 Claude Code Desktop 风格的温暖深灰色调

**Architecture:** 更新全局 CSS 变量 + 逐个组件迁移到新设计系统，保持现有功能不变

**Tech Stack:** Next.js, React, CSS Variables, JetBrains Mono + Inter 字体

---

## File Structure

**修改文件:**
- `packages/web/src/styles/globals.css` - 全局样式变量和基础样式
- `packages/web/src/app/layout.tsx` - 字体引入
- `packages/web/src/components/sidebar/index.tsx` - 侧边栏
- `packages/web/src/components/sidebar/project-card.tsx` - 项目卡片
- `packages/web/src/components/sidebar/user-section.tsx` - 用户区域
- `packages/web/src/components/terminal/terminal-panel.tsx` - 终端面板
- `packages/web/src/components/terminal/index.tsx` - 终端组件
- `packages/web/src/components/auth-form.tsx` - 登录/注册表单
- `packages/web/src/components/create-project-dialog.tsx` - 创建项目对话框
- `packages/web/src/app/dashboard/page.tsx` - Dashboard 页面
- `packages/web/src/components/workspace/index.tsx` - 工作区
- `packages/web/src/components/collaboration/*.tsx` - 协作组件

**删除文件:**
- `packages/web/src/app/design-demo/page.tsx` - 演示页面（完成后删除）

---

### Task 1: 更新全局样式变量

**Files:**
- Modify: `packages/web/src/styles/globals.css`

- [ ] **Step 1: 更新 CSS 变量为 Claude 风格配色**

```css
/* packages/web/src/styles/globals.css */

:root {
  /* 背景色 - 温暖深灰 */
  --bg-primary: #1a1a1a;
  --bg-secondary: #202020;
  --bg-card: #252525;
  --bg-hover: #2a2a2a;
  --bg-active: #303030;

  /* 强调色 - 珊瑚橙 */
  --accent-primary: #d97757;
  --accent-hover: #c55a3b;
  --accent-light: #f0a080;

  /* 成功/状态色 */
  --status-running: #4ade80;
  --status-stopped: #f87171;
  --status-warning: #fbbf24;

  /* 文本色 - 温暖灰 */
  --text-primary: #e5e5e5;
  --text-secondary: #a0a0a0;
  --text-muted: #6b6b6b;

  /* 边框 */
  --border-color: #333333;
  --border-light: #404040;

  /* 旧变量兼容 */
  --accent-color: #d97757;
  --accent-hover-old: #c55a3b;
  --accent-light-old: #f0a080;
  --text-disabled: #6b6b6b;
  --status-success: #4ade80;
  --status-error: #f87171;

  /* 尺寸 */
  --sidebar-width: 250px;
  --status-bar-height: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* 字体 */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace;
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

a { color: var(--accent-primary); text-decoration: none; }
a:hover { color: var(--accent-light); }

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background: var(--accent-primary);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

/* 输入框 */
.input {
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  font-family: var(--font-sans);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: border-color 0.15s ease;
}

.input::placeholder { color: var(--text-muted); }
.input:focus { outline: none; border-color: var(--accent-primary); }

/* 卡片 */
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
}

/* 元素标签样式 */
.element-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
}

.element-tag .remove {
  color: var(--text-muted);
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

/* 状态指示器动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

- [ ] **Step 2: 验证样式编译**

Run: `cd /root/my/code-link/packages/web && npm run build`
Expected: 构建成功无错误

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/web/src/styles/globals.css
git -C /root/my/code-link commit -m "style: 更新全局样式变量为 Claude 风格配色"
```

---

### Task 2: 添加字体引入

**Files:**
- Modify: `packages/web/src/app/layout.tsx`

- [ ] **Step 1: 更新 layout.tsx 引入 Inter 和 JetBrains Mono 字体**

```tsx
// packages/web/src/app/layout.tsx
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { OrganizationProvider } from '@/lib/organization-context';
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
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <OrganizationProvider>{children}</OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/app/layout.tsx
git -C /root/my/code-link commit -m "style: 添加 Inter 和 JetBrains Mono 字体"
```

---

### Task 3: 更新侧边栏组件

**Files:**
- Modify: `packages/web/src/components/sidebar/index.tsx`

- [ ] **Step 1: 更新侧边栏样式**

阅读现有文件后更新样式，主要改动：
- 背景色使用 `var(--bg-secondary)`
- 边框使用 `var(--border-color)`
- 项目状态指示器添加脉冲动画
- 组织选择器样式更新

- [ ] **Step 2: 验证侧边栏渲染**

Run: `cd /root/my/code-link/packages/web && npm run build`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/index.tsx
git -C /root/my/code-link commit -m "style: 更新侧边栏组件为 Claude 风格"
```

---

### Task 4: 更新项目卡片组件

**Files:**
- Modify: `packages/web/src/components/sidebar/project-card.tsx`

- [ ] **Step 1: 更新项目卡片样式**

主要改动：
- 激活状态使用珊瑚橙边框
- 运行状态指示器添加脉冲动画
- hover 效果更柔和

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/project-card.tsx
git -C /root/my/code-link commit -m "style: 更新项目卡片组件样式"
```

---

### Task 5: 更新用户区域组件

**Files:**
- Modify: `packages/web/src/components/sidebar/user-section.tsx`

- [ ] **Step 1: 更新用户区域样式**

主要改动：
- 头像使用珊瑚橙背景
- 用户信息使用暖灰色文字
- 登出按钮使用 btn-secondary 风格

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/user-section.tsx
git -C /root/my/code-link commit -m "style: 更新用户区域组件样式"
```

---

### Task 6: 更新终端组件

**Files:**
- Modify: `packages/web/src/components/terminal/index.tsx`
- Modify: `packages/web/src/components/terminal/terminal-panel.tsx`

- [ ] **Step 1: 更新终端样式**

主要改动：
- 终端背景使用 `var(--bg-secondary)`
- 光标使用绿色方块动画
- 提示符使用 `var(--status-running)` 颜色
- 终端头部使用 tab 切换风格

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/terminal/
git -C /root/my/code-link commit -m "style: 更新终端组件样式"
```

---

### Task 7: 更新认证表单组件

**Files:**
- Modify: `packages/web/src/components/auth-form.tsx`

- [ ] **Step 1: 更新登录/注册表单样式**

主要改动：
- 表单容器使用 `var(--bg-card)` 背景
- 输入框使用新的 input 样式
- 按钮使用 btn-primary 和 btn-secondary

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/auth-form.tsx
git -C /root/my/code-link commit -m "style: 更新认证表单组件样式"
```

---

### Task 8: 更新对话框组件

**Files:**
- Modify: `packages/web/src/components/create-project-dialog.tsx`
- Modify: `packages/web/src/components/create-organization-dialog.tsx`
- Modify: `packages/web/src/components/invite-member-dialog.tsx`

- [ ] **Step 1: 更新对话框样式**

主要改动：
- 对话框背景使用 `var(--bg-card)`
- 遮罩使用 `rgba(0, 0, 0, 0.6)`
- 按钮使用新风格

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/create-project-dialog.tsx packages/web/src/components/create-organization-dialog.tsx packages/web/src/components/invite-member-dialog.tsx
git -C /root/my/code-link commit -m "style: 更新对话框组件样式"
```

---

### Task 9: 更新协作组件

**Files:**
- Modify: `packages/web/src/components/collaboration/index.tsx`
- Modify: `packages/web/src/components/collaboration/message-panel.tsx`
- Modify: `packages/web/src/components/collaboration/message-input.tsx`
- Modify: `packages/web/src/components/collaboration/message-item.tsx`
- Modify: `packages/web/src/components/collaboration/online-users.tsx`

- [ ] **Step 1: 更新协作组件样式**

主要改动：
- 消息面板使用 `var(--bg-secondary)` 背景
- 在线用户指示器使用 `var(--status-running)` 颜色
- 消息输入框使用新 input 样式

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/collaboration/
git -C /root/my/code-link commit -m "style: 更新协作组件样式"
```

---

### Task 10: 更新设置页面

**Files:**
- Modify: `packages/web/src/app/settings/page.tsx`
- Modify: `packages/web/src/components/settings/settings-tabs.tsx`
- Modify: `packages/web/src/components/settings/organization-tab-content.tsx`
- Modify: `packages/web/src/components/settings/organization-detail-panel.tsx`

- [ ] **Step 1: 更新设置页面样式**

主要改动：
- 标签页使用 `var(--bg-card)` 和 `var(--bg-active)`
- 边框使用 `var(--border-color)`
- 按钮使用新风格

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/app/settings/ packages/web/src/components/settings/
git -C /root/my/code-link commit -m "style: 更新设置页面样式"
```

---

### Task 11: 更新 Dashboard 和其他页面

**Files:**
- Modify: `packages/web/src/app/dashboard/page.tsx`
- Modify: `packages/web/src/app/login/page.tsx`
- Modify: `packages/web/src/app/register/page.tsx`
- Modify: `packages/web/src/app/invitations/page.tsx`
- Modify: `packages/web/src/app/page.tsx`
- Modify: `packages/web/src/components/workspace/index.tsx`

- [ ] **Step 1: 更新页面样式**

主要改动：
- 加载状态使用新配色
- 页面背景使用 `var(--bg-primary)`
- 文字使用暖灰色

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/app/ packages/web/src/components/workspace/
git -C /root/my/code-link commit -m "style: 更新页面样式"
```

---

### Task 12: 清理演示页面

**Files:**
- Delete: `packages/web/src/app/design-demo/page.tsx`

- [ ] **Step 1: 删除演示页面**

```bash
rm -rf packages/web/src/app/design-demo
```

- [ ] **Step 2: Commit**

```bash
git -C /root/my/code-link add packages/web/src/app/design-demo
git -C /root/my/code-link commit -m "chore: 删除设计演示页面"
```

---

### Task 13: 最终验证

- [ ] **Step 1: 运行完整构建**

Run: `cd /root/my/code-link/packages/web && npm run build`
Expected: 构建成功无错误

- [ ] **Step 2: 启动开发服务器验证**

Run: `cd /root/my/code-link/packages/web && npm run dev`
Expected: 服务启动成功，访问 localhost:3000 验证 UI

- [ ] **Step 3: 最终提交**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "style: 完成 Claude 风格 UI 重设计"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] 全局样式变量 - Task 1
- [x] 字体引入 - Task 2
- [x] 侧边栏 - Task 3
- [x] 项目卡片 - Task 4
- [x] 用户区域 - Task 5
- [x] 终端 - Task 6
- [x] 认证表单 - Task 7
- [x] 对话框 - Task 8
- [x] 协作组件 - Task 9
- [x] 设置页面 - Task 10
- [x] 其他页面 - Task 11
- [x] 清理 - Task 12
- [x] 验证 - Task 13

**2. Placeholder scan:** 无 TBD/TODO 占位符

**3. Type consistency:** CSS 变量命名一致，组件间引用正确
