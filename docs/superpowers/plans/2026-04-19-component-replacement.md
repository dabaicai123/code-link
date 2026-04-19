# 组件替换计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有手写样式的按钮、输入框、对话框等替换为 Shadcn/ui 组件。

**Architecture:** 渐进式替换，优先替换高频使用的组件。

**Tech Stack:** Shadcn/ui + React

---

## 替换优先级

| 优先级 | 组件 | 说明 |
|--------|------|------|
| 1 | 按钮 | 全局替换 `.btn-*` 类为 Button 组件 |
| 2 | 输入框 | 替换 `.input` 类为 Input 组件 |
| 3 | 对话框 | 替换自定义对话框为 Dialog 组件 |
| 4 | 标签页 | 替换 settings-tabs 为 Tabs 组件 |
| 5 | 用户头像 | 替换在线用户头像为 Avatar 组件 |

---

## Task 1: 更新 auth-form.tsx 使用 Shadcn 组件

**Files:**
- Modify: `packages/web/src/components/auth-form.tsx`

- [ ] **Step 1: 读取当前组件**

读取 `packages/web/src/components/auth-form.tsx`，将按钮替换为 Button 组件，输入框替换为 Input 组件。

- [ ] **Step 2: 更新导入**

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
```

- [ ] **Step 3: 替换按钮**

将 `<button className="btn btn-primary">` 替换为 `<Button>`。

- [ ] **Step 4: 替换输入框**

将 `<input className="input" />` 替换为 `<Input />`。

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/auth-form.tsx && git -C /root/my/code-link commit -m "refactor(web): update auth-form to use Shadcn components"
```

---

## Task 2: 更新 sidebar/index.tsx 使用 Shadcn 组件

**Files:**
- Modify: `packages/web/src/components/sidebar/index.tsx`

- [ ] **Step 1: 更新导入**

```typescript
import { Button } from '@/components/ui/button';
```

- [ ] **Step 2: 替换按钮**

将所有 `<button className="btn btn-secondary">` 替换为 `<Button variant="secondary">`。

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/index.tsx && git -C /root/my/code-link commit -m "refactor(web): update sidebar to use Button component"
```

---

## Task 3: 更新 collaboration/index.tsx 使用 Shadcn 组件

**Files:**
- Modify: `packages/web/src/components/collaboration/index.tsx`

- [ ] **Step 1: 更新导入**

```typescript
import { Button } from '@/components/ui/button';
```

- [ ] **Step 2: 替换按钮**

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/collaboration/index.tsx && git -C /root/my/code-link commit -m "refactor(web): update collaboration to use Button component"
```

---

## Task 4: 更新 settings-tabs.tsx 使用 Tabs 组件

**Files:**
- Modify: `packages/web/src/components/settings/settings-tabs.tsx`

- [ ] **Step 1: 更新导入**

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

- [ ] **Step 2: 替换标签页实现**

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/settings/settings-tabs.tsx && git -C /root/my/code-link commit -m "refactor(web): update settings-tabs to use Tabs component"
```

---

## Task 5: 更新 online-users.tsx 使用 Avatar 组件

**Files:**
- Modify: `packages/web/src/components/collaboration/online-users.tsx`

- [ ] **Step 1: 更新导入**

```typescript
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
```

- [ ] **Step 2: 替换头像实现**

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/collaboration/online-users.tsx && git -C /root/my/code-link commit -m "refactor(web): update online-users to use Avatar component"
```

---

## Task 6: 更新 draft-header.tsx 使用 Avatar 和 Badge 组件

**Files:**
- Modify: `packages/web/src/components/collaboration/draft-header.tsx`

- [ ] **Step 1: 更新导入**

```typescript
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
```

- [ ] **Step 2: 替换组件**

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/collaboration/draft-header.tsx && git -C /root/my/code-link commit -m "refactor(web): update draft-header to use Shadcn components"
```

---

## Task 7: 更新其他对话框组件

**Files:**
- Modify: `packages/web/src/components/create-project-dialog.tsx`
- Modify: `packages/web/src/components/create-organization-dialog.tsx`
- Modify: `packages/web/src/components/invite-member-dialog.tsx`

- [ ] **Step 1: 替换 create-project-dialog.tsx**

使用 Dialog 组件替换自定义对话框实现。

- [ ] **Step 2: 替换 create-organization-dialog.tsx**

- [ ] **Step 3: 替换 invite-member-dialog.tsx**

- [ ] **Step 4: 提交**

```bash
git -C /root/my/code-link add packages/web/src/components/create-project-dialog.tsx packages/web/src/components/create-organization-dialog.tsx packages/web/src/components/invite-member-dialog.tsx && git -C /root/my/code-link commit -m "refactor(web): update dialog components to use Shadcn Dialog"
```

---

## Task 8: 运行构建验证

**Files:**
- None

- [ ] **Step 1: 运行前端构建**

Run:
```bash
cd /root/my/code-link && pnpm --filter @code-link/web build
```

Expected: 构建成功

---

## 任务总结

| 任务 | 说明 |
|------|------|
| Task 1-3 | 替换按钮和输入框 |
| Task 4 | 替换标签页 |
| Task 5-6 | 替换头像和徽章 |
| Task 7 | 替换对话框 |
| Task 8 | 构建验证 |