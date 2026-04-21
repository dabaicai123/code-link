# 前端架构重构设计文档

**日期**: 2026-04-21
**分支**: refactor/frontend-architecture
**策略**: 集中式重构，独立分支，完成后合并回 main 为一个 commit

## 1. CSS/样式体系统一

### 问题
- `tailwind.config.ts` 使用 v3 格式（`darkMode`, `extend.colors`），但 `postcss.config.mjs` 用 v4 `@tailwindcss/postcss` — 配置矛盾
- 6 个文件使用硬编码 Tailwind 颜色（`bg-blue-500` 等）而非语义 token
- `settings/page.tsx` 有 ~30 个 `style={{}}` inline style 对象
- `repo-list.tsx` 有 ~20 个 inline styles + 硬编码 `rgba(248, 113, 113, 0.1)`
- `draft.ts:108` 有硬编码 hex `'#22c55e'`

### 修复

**1.1 Tailwind 配置迁移到 v4 格式**
- 移除 `tailwind.config.ts` 中 v3 风格的 `darkMode`、`extend.colors` 等配置
- 将颜色定义迁移到 `globals.css` 使用 `@theme` 指令（v4 标准方式）
- 确保 `postcss.config.mjs` 继续使用 `@tailwindcss/postcss`

**1.2 硬编码颜色 → 语义 token**
映射关系：
| 硬编码值 | 语义 token |
|----------|-----------|
| `bg-blue-500` | `bg-primary` |
| `bg-green-500` | `bg-success` |
| `bg-red-500` | `bg-destructive` |
| `bg-gray-50` | `bg-muted` |
| `bg-indigo-600` | `bg-primary` (需确认设计意图) |
| `text-orange-600` | `text-warning` |
| `text-red-500` | `text-destructive` |
| `border-gray-200` | `border-muted` |
| `border-orange-300` | `border-warning` |
| `border-red-300` | `border-destructive` |

在 `globals.css` 中添加缺失的语义 token（`--success`, `--warning`, `--info`）

**1.3 inline style → Tailwind 类**（`settings/page.tsx` 和 `chat-panel.tsx` 的 inline style 替换在 Section 3 拆分时同步完成，此处不重复操作）
- `repo-list.tsx`: 所有 `style={{}}` 替换为 Tailwind utility classes，`rgba(248, 113, 113, 0.1)` → `bg-destructive/10`
- `draft.ts`: `'#22c55e'` → `var(--color-success)` 或 Tailwind class

**影响文件**（不含 settings/page.tsx，其在 Section 3 处理）：
- `globals.css` — 添加新 token
- `tailwind.config.ts` — v3→v4 迁移
- `development-card.tsx`, `plans-card.tsx`, `brainstorming-card.tsx`, `card-detail-modal.tsx` — 硬编码颜色替换
- `repo-import-dialog.tsx` — 硬编码颜色替换
- `repo-list.tsx` — inline style 替换 + 硬编码颜色替换
- `chat-panel.tsx` — 硬编码颜色替换（inline style 在 Section 3 处理）
- `types/draft.ts` — hex 替换

## 2. 目录结构与模块边界

### 问题
- `components/` 根目录有 ~10 个散文件，没有 feature folder 分组
- `api.ts` 294行混合了类型 re-export 和请求逻辑
- `prototype.tsx` 752行（含 mock 数据）存在于生产代码树中

### 修复

**2.1 components/ 散文件 → feature folders**
```
components/
  repo-list.tsx, repo-import-dialog.tsx → components/project/
  auth-form.tsx → components/auth/
  create-project-dialog.tsx → components/project/
  [其余散文件按功能归类到对应 feature folder]
```

每个 feature folder 包含该功能的所有组件，直接 import 路径即可（不需要 index 文件）。

**2.2 api.ts 拆分类型与请求**
- `lib/api-client.ts`: 只保留 HTTP 请求逻辑（fetch wrapper + token + 错误处理），约 180 行
- 类型导出移除：`export type { OrgRole } from '@/types/user'` 等全部删除，组件改为直接从 `@/types/*` import
- 保留 `lib/api.ts` 作为 re-export 过渡文件：`export { api } from './api-client'`

**2.3 删除 prototype.tsx**
- 直接删除 `src/components/collaboration/prototype.tsx`（752行 mock 数据，非生产代码）
- 检查是否有其他文件 import 它，如果有则更新 import

**影响文件**：
- 新建 `components/project/`, `components/auth/` 等目录
- 移动散文件到对应目录
- `lib/api.ts` → `lib/api-client.ts` + 保留过渡 `api.ts`
- 所有 import `@/lib/api` 类型的地方 → `@/types/*`
- 删除 `prototype.tsx`

## 3. God files 拆分

### 问题
- `chat-input.tsx` (544行): 命令菜单 + 图片上传 + 粘贴处理 + 表单 + 工具栏 + 回复预览 + 类型切换
- `settings/page.tsx` (313行): 成员管理 + 邀请管理 + 组织设置 + ~30 inline styles

### 修复

**3.1 chat-input.tsx → 5 个子组件**
```
components/chat/
  chat-input.tsx          (主组件，~100行，组装子组件 + form state)
  chat-command-menu.tsx   (命令菜单逻辑，~80行)
  chat-image-upload.tsx   (图片上传+粘贴，~80行)
  chat-input-toolbar.tsx  (工具栏按钮，~60行)
  chat-reply-preview.tsx  (回复预览区域，~50行)
```

拆分原则：
- 每个子组件通过 props 接收数据和回调，不共享内部 state
- `chat-input.tsx` 作为容器管理 react-hook-form state 和协调子组件
- 粘贴逻辑如果复用价值高则提取为 `usePasteHandler` hook

**3.2 settings/page.tsx → 3 个子组件**
```
components/settings/
  organization-detail-panel.tsx  (已存在，保留)
  settings-page.tsx              (主页面，~60行)
  members-tab.tsx                (成员列表，~80行)
  invitations-tab.tsx            (邀请管理，~80行)
```

同时将所有 inline style 替换为 Tailwind classes（与 Section 1 同步）。

**影响文件**：
- 新建 4 个 chat 子组件文件
- 重写 `chat-input.tsx` 为容器组件
- 新建 2 个 settings 子组件文件
- 重写 `settings/page.tsx` 为容器组件

## 4. 关键模块重写

### 问题
- `api.ts` 混合类型 re-export + HTTP 请求 + token 存储 + 错误处理
- 类型导出造成不必要的耦合

### 修复

**4.1 api.ts 重写为 api-client.ts**
新 `lib/api-client.ts` (~180行) 只包含：
- HTTP 方法（get/post/put/delete）
- Token 刷新逻辑
- 错误处理
- 不导出任何类型

保留 `lib/api.ts` 作为过渡：
```ts
export { api } from './api-client'
```

**4.2 类型导入路径修正**
所有 `import { SomeType } from '@/lib/api'` → `import { SomeType } from '@/types/some-file'`

**影响文件**：
- `lib/api.ts` → 重写为过渡 re-export
- 新建 `lib/api-client.ts`
- 约 6-8 个文件的 import 路径修正

## 执行顺序

在独立分支 `refactor/frontend-architecture` 上执行：

1. **CSS/样式体系统一** (Section 1) — 基础层，其他修改依赖此
2. **关键模块重写** (Section 4) — api.ts 拆分，解除类型耦合
3. **目录重组** (Section 2) — 文件移动和删除
4. **God files 拆分** (Section 3) — 依赖新目录结构

完成后合并回 main 为一个 commit。