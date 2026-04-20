# React 代码质量修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复代码审查中发现的 P0-P2 问题，包括类型重复、组件职责过重、状态管理不当、性能优化等。

**Architecture:**
1. 统一类型定义到 `src/types/` 目录，消除各处重复定义
2. 重构 Sidebar 组件，分离数据获取逻辑
3. 优化全局状态管理，移除不必要的全局状态
4. 添加性能优化（memo、useMemo、useCallback）

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, TanStack Query

---

## 文件结构变更

### 新建文件
- `src/types/project.ts` - 扩展现有文件，添加完整 Project 类型
- `src/types/user.ts` - 扩展现有文件，添加完整 User 类型
- `src/hooks/use-sidebar-projects.ts` - Sidebar 数据获取 hook

### 修改文件
- `src/lib/stores/ui-store.ts` - 移除 dialog 状态
- `src/lib/stores/auth-store.ts` - 移除本地 User 定义，使用 types/user
- `src/components/workspace/index.tsx` - 使用统一类型
- `src/components/sidebar/index.tsx` - 重构，使用 hook 和统一类型
- `src/components/terminal/index.tsx` - 使用统一类型
- `src/lib/queries/use-projects.ts` - 使用统一类型
- `src/components/collaboration/message-panel.tsx` - 修复依赖问题
- `src/components/collaboration/draft-list.tsx` - 修复依赖问题
- `src/components/repo-import-dialog.tsx` - 消除 any 类型
- `src/app/settings/page.tsx` - 消除 any 类型
- `src/components/project-card.tsx` - 添加 memo（如存在）

---

## Task 1: 统一 Project 类型定义

**Files:**
- Modify: `src/types/project.ts`
- Modify: `src/lib/queries/use-projects.ts`
- Modify: `src/components/workspace/index.tsx`
- Modify: `src/components/sidebar/index.tsx`
- Modify: `src/components/terminal/index.tsx`

- [ ] **Step 1: 更新 src/types/project.ts 添加完整 Project 类型**

```typescript
export interface Project {
  id: number;
  name: string;
  templateType: TemplateType;
  organizationId: number;
  containerId: string | null;
  status: ProjectStatus;
  createdBy: number;
  createdAt: string;
}

export type TemplateType = 'node' | 'node+java' | 'node+python';
export type ProjectStatus = 'created' | 'running' | 'stopped';

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  running: 'var(--status-success)',
  stopped: 'var(--status-warning)',
  created: 'var(--text-disabled)',
};
```

- [ ] **Step 2: 更新 src/lib/queries/use-projects.ts 使用统一类型**

删除本地 Project 接口定义（第 5-14 行），改为从 types 导入：

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationStore } from '@/lib/stores';
import type { Project } from '@/types';

// 删除本地 Project 接口定义

export const projectKeys = {
  // ... 保持不变
};
```

- [ ] **Step 3: 更新 src/components/workspace/index.tsx 使用统一类型**

删除本地 Project 接口（第 9-14 行），添加导入：

```typescript
import type { Project } from '@/types';
```

- [ ] **Step 4: 更新 src/components/sidebar/index.tsx 使用统一类型**

删除本地 Project 和 User 接口（第 13-28 行），添加导入：

```typescript
import type { Project, User } from '@/types';
```

- [ ] **Step 5: 更新 src/components/terminal/index.tsx 使用统一类型**

删除本地 Project 接口（第 11-15 行），添加导入：

```typescript
import type { Project } from '@/types';
```

- [ ] **Step 6: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git -C /root/my/code-link add packages/web/src/types/project.ts packages/web/src/lib/queries/use-projects.ts packages/web/src/components/workspace/index.tsx packages/web/src/components/sidebar/index.tsx packages/web/src/components/terminal/index.tsx
git -C /root/my/code-link commit -m "refactor(web): unify Project type definition across components"
```

---

## Task 2: 统一 User 类型定义

**Files:**
- Modify: `src/types/user.ts`
- Modify: `src/lib/stores/auth-store.ts`

- [ ] **Step 1: 确认 src/types/user.ts 已有完整定义**

现有内容已正确：
```typescript
export interface User {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
}

export type OrgRole = 'owner' | 'developer' | 'member';
```

- [ ] **Step 2: 更新 src/lib/stores/auth-store.ts 使用统一类型**

删除本地 User 接口（第 4-9 行），改为从 types 导入：

```typescript
import { create } from 'zustand';
import { storage } from '../storage';
import type { User } from '@/types';

// 删除本地 User 接口定义

interface AuthState {
  user: User | null;
  token: string | null;
  // ... 保持不变
}
```

- [ ] **Step 3: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git -C /root/my/code-link add packages/web/src/lib/stores/auth-store.ts
git -C /root/my/code-link commit -m "refactor(web): use unified User type from types/user"
```

---

## Task 3: 移除 UI Store 中不必要的全局状态

**Files:**
- Modify: `src/lib/stores/ui-store.ts`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: 更新 src/lib/stores/ui-store.ts 移除 dialog 状态**

```typescript
import { create } from 'zustand';

interface UIState {
  sidebarExpanded: boolean;
  globalLoading: boolean;
  toggleSidebar: () => void;
  setGlobalLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  sidebarExpanded: true,
  globalLoading: false,
};

export const useUIStore = create<UIState>()((set) => ({
  ...initialState,

  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

  setGlobalLoading: (loading) =>
    set({ globalLoading: loading }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: 确认 dashboard 已使用局部状态**

检查 `src/app/dashboard/page.tsx`，确认 `isDialogOpen` 已是局部状态（第 28 行），无需修改。

- [ ] **Step 3: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git -C /root/my/code-link add packages/web/src/lib/stores/ui-store.ts
git -C /root/my/code-link commit -m "refactor(web): remove dialog states from global UI store"
```

---

## Task 4: 重构 Sidebar 组件 - 提取数据获取逻辑

**Files:**
- Create: `src/hooks/use-sidebar-projects.ts`
- Modify: `src/components/sidebar/index.tsx`

- [ ] **Step 1: 创建 src/hooks/use-sidebar-projects.ts**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Project } from '@/types';

interface UseSidebarProjectsOptions {
  organizationId: number | null;
  refreshKey?: number;
}

export function useSidebarProjects({ organizationId, refreshKey }: UseSidebarProjectsOptions) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!organizationId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.get<Project[]>(`/projects?organizationId=${organizationId}`);
      setProjects(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '获取项目列表失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, refreshKey]);

  const runningProjects = projects.filter((p) => p.status === 'running');
  const stoppedProjects = projects.filter((p) => p.status !== 'running');

  return {
    projects,
    runningProjects,
    stoppedProjects,
    loading,
    error,
    refetch: fetchProjects,
  };
}
```

- [ ] **Step 2: 重构 src/components/sidebar/index.tsx 使用新 hook**

移除 `fetchProjects` 函数和相关状态，改用 hook：

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { api, Organization } from '@/lib/api';
import { useOrganizationStore } from '@/lib/stores';
import { useOrganizations } from '@/lib/queries';
import { useSidebarProjects } from '@/hooks/use-sidebar-projects';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Project, User } from '@/types';

interface SidebarProps {
  user: User;
  activeProjectId: number | null;
  refreshKey?: number;
  onProjectSelect: (project: Project) => void;
  onCreateProject: () => void;
  onLogout: () => void;
  invitationCount?: number;
}

export function Sidebar({ user, activeProjectId, refreshKey, onProjectSelect, onCreateProject, onLogout, invitationCount }: SidebarProps) {
  const router = useRouter();
  const organizations = useOrganizationStore((s) => s.organizations);
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const setCurrentOrganization = useOrganizationStore((s) => s.setCurrentOrganization);
  const { isLoading: orgLoading } = useOrganizations();
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  // 使用新 hook 获取项目数据
  const { runningProjects, stoppedProjects, loading, refetch } = useSidebarProjects({
    organizationId: currentOrganization?.id ?? null,
    refreshKey,
  });

  const toggleExpand = (projectId: number) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // ... 渲染逻辑保持不变，将 projects.filter 相关代码替换为 runningProjects/stoppedProjects
}
```

- [ ] **Step 3: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git -C /root/my/code-link add packages/web/src/hooks/use-sidebar-projects.ts packages/web/src/components/sidebar/index.tsx
git -C /root/my/code-link commit -m "refactor(web): extract project fetching logic from Sidebar to custom hook"
```

---

## Task 5: 修复 useEffect 依赖问题

**Files:**
- Modify: `src/components/collaboration/message-panel.tsx`
- Modify: `src/components/collaboration/draft-list.tsx`

- [ ] **Step 1: 修复 src/components/collaboration/message-panel.tsx 的 useEffect 依赖**

将 `loadMessages` 用 `useCallback` 包裹：

```typescript
const loadMessages = useCallback(async () => {
  try {
    setLoading(true);
    const result = await api.getDraftMessages(draft.id, { limit: 100 });
    setMessages(result.messages);
    setTimeout(scrollToBottom, 50);
  } catch (err) {
    console.error('Failed to load messages:', err);
  } finally {
    setLoading(false);
  }
}, [draft.id]);

useEffect(() => {
  loadMessages();
}, [loadMessages]);
```

- [ ] **Step 2: 修复 src/components/collaboration/draft-list.tsx 的 useEffect 依赖**

将 `loadDrafts` 用 `useCallback` 包裹：

```typescript
const loadDrafts = useCallback(async () => {
  try {
    setLoading(true);
    const result = await api.getDrafts(projectId);
    setDrafts(result.drafts);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : '加载失败');
  } finally {
    setLoading(false);
  }
}, [projectId]);

useEffect(() => {
  loadDrafts();
}, [loadDrafts]);
```

- [ ] **Step 3: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/collaboration/message-panel.tsx packages/web/src/components/collaboration/draft-list.tsx
git -C /root/my/code-link commit -m "fix(web): add missing useCallback dependencies to useEffect hooks"
```

---

## Task 6: 消除 any 类型

**Files:**
- Modify: `src/components/repo-import-dialog.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: 修复 src/components/repo-import-dialog.tsx 的 any 类型**

添加类型定义并替换 any：

```typescript
// 在文件顶部添加类型定义（约第 28 行后）
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_ref: string;
  private: boolean;
}

// 修改 loadRepos 函数中的 any 使用（约第 110 行）
const formattedRepos: Repo[] = (data as (GitHubRepo | GitLabProject)[]).map((repo) => ({
  id: repo.id,
  name: repo.name,
  full_name: 'full_name' in repo ? repo.full_name : repo.path_with_namespace,
  url: 'html_url' in repo ? repo.html_url : repo.web_url,
  default_branch: repo.default_branch || ('default_ref' in repo ? repo.default_ref : 'main'),
  private: repo.private,
}));
```

- [ ] **Step 2: 修复 src/app/settings/page.tsx 的 any 类型**

```typescript
// 修改 handleSave 函数中的 catch（约第 94 行）
} catch (err) {
  const message = err instanceof Error ? err.message : '保存配置失败';
  setError(message);
}
```

- [ ] **Step 3: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/repo-import-dialog.tsx packages/web/src/app/settings/page.tsx
git -C /root/my/code-link commit -m "fix(web): eliminate any types with proper type definitions"
```

---

## Task 7: 添加性能优化

**Files:**
- Modify: `src/components/sidebar/project-card.tsx`
- Modify: `src/components/collaboration/message-item.tsx`

- [ ] **Step 1: 读取 src/components/sidebar/project-card.tsx 确认结构**

Read: `packages/web/src/components/sidebar/project-card.tsx`

- [ ] **Step 2: 为 ProjectCard 添加 memo**

```typescript
import { memo } from 'react';
// ... 其他 imports

interface ProjectCardProps {
  project: Project;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  onRefresh: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  isActive,
  isExpanded,
  onToggleExpand,
  onClick,
  onRefresh,
}: ProjectCardProps) {
  // ... 组件内容保持不变
});
```

- [ ] **Step 3: 为 MessageItem 添加 memo**

读取并更新 `src/components/collaboration/message-item.tsx`：

```typescript
import { memo } from 'react';
// ... 其他 imports

interface MessageItemProps {
  message: DraftMessage;
  currentUserId?: number;
  onReply: (message: DraftMessage) => void;
  onConfirm: (messageId: number, type: string) => void;
}

export const MessageItem = memo(function MessageItem({
  message,
  currentUserId,
  onReply,
  onConfirm,
}: MessageItemProps) {
  // ... 组件内容保持不变
});
```

- [ ] **Step 4: 运行 TypeScript 检查验证**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/project-card.tsx packages/web/src/components/collaboration/message-item.tsx
git -C /root/my/code-link commit -m "perf(web): add React.memo to list item components"
```

---

## Task 8: 最终验证和清理

**Files:**
- 全局验证

- [ ] **Step 1: 运行完整 TypeScript 检查**

Run: `cd /root/my/code-link/packages/web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 运行现有测试**

Run: `cd /root/my/code-link/packages/web && npm test`
Expected: 所有测试通过

- [ ] **Step 3: 检查 ESLint（如配置）**

Run: `cd /root/my/code-link/packages/web && npx eslint src --ext .ts,.tsx 2>/dev/null || true`
Expected: 无严重错误

- [ ] **Step 4: 最终 commit（如有遗漏修改）**

```bash
git -C /root/my/code-link status --short packages/web/
# 如有未提交的修改，添加并提交
```

---

## 自检清单

- [x] **Spec 覆盖**: 每个审查问题都有对应任务
  - P0-1 类型重复 → Task 1, 2
  - P0-2 Sidebar 职责过重 → Task 4
  - P0-3 全局状态过度使用 → Task 3
  - P1-4 any 类型 → Task 6
  - P1-6/7 useEffect 依赖 → Task 5
  - P2-8 memo 优化 → Task 7
- [x] **占位符扫描**: 无 TBD/TODO/待实现内容
- [x] **类型一致性**: 所有类型引用来自 `@/types`
