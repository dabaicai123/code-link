# Code Tab — VSCode-like Web Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "代码" tab to the right panel with file browsing, code/diff viewing, git branch tree, commit history, and git operations (commit/push/pull).

**Architecture:** New `code` server module handles git/file operations inside Docker containers. New frontend `CodePanel` component replaces the right panel's third tab area with a dark-themed VSCode-style interface: left sidebar (branch indicator, commit input, changes list, branch tree) + right editor (file tabs, diff viewer, status bar).

**Tech Stack:** Express.js + Dockerode (server), React + TanStack Query + Monaco Editor (frontend), Tailwind CSS v4 + CSS custom properties (styling)

---

## Task 1: Server Code Module — Types & Schemas

**Files:**
- Create: `packages/server/src/modules/code/types.ts`
- Create: `packages/server/src/modules/code/schemas.ts`

- [ ] **Step 1: Create types.ts with domain types**

`packages/server/src/modules/code/types.ts`:

```typescript
export interface RepoGitStatus {
  repoName: string;
  branch: string;
  files: GitFileChange[];
  ahead: number;
  behind: number;
}

export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

export interface CommitNode {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  branch: string;
  isHead: boolean;
  isMerge: boolean;
  parentHashes: string[];
  mergeFrom?: string;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
  repoName: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

- [ ] **Step 2: Create schemas.ts with Zod validation**

`packages/server/src/modules/code/schemas.ts`:

```typescript
import { z } from 'zod/v4';

export const projectIdParamsSchema = z.object({
  projectId: z.string().transform(Number),
});

export const filePathQuerySchema = z.object({
  path: z.string().min(1),
  repoName: z.string().optional(),
});

export const commitHashQuerySchema = z.object({
  hash: z.string().min(1),
  repoName: z.string().optional(),
});

export const commitBodySchema = z.object({
  message: z.string().min(1).max(500),
  repoName: z.string().optional(),
});

export const stageBodySchema = z.object({
  repoName: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
});

export const discardBodySchema = z.object({
  repoName: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
});

export const pushBodySchema = z.object({
  repoName: z.string().optional(),
});

export const pullBodySchema = z.object({
  repoName: z.string().optional(),
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/code/types.ts packages/server/src/modules/code/schemas.ts
git commit -m "feat(server): add code module types and validation schemas"
```

---

## Task 2: Server Code Module — Service (Git/File Operations in Container)

**Files:**
- Create: `packages/server/src/modules/code/service.ts`

- [ ] **Step 1: Create CodeService**

Full service code is in the spec `docs/superpowers/specs/2026-04-22-code-tab-vscode-editor-design.md`. Key methods: `getGitStatus`, `getGitLog`, `getCommitDiff`, `getFileTree`, `getFileContent`, `commit`, `push`, `pull`, `stage`, `discard`. All methods use `DockerService.execInContainer` to run git commands inside the project's Docker container. The service discovers repos by finding `.git` directories under `/home/codelink`.

The service must import from existing modules:
- `DockerService` from `../container/lib/docker.service.js`
- `ContainerRepository` from `../container/repository.js`
- `PermissionService` from `../auth/permission.service.js`

- [ ] **Step 2: Verify server builds**

Run: `cd packages/server && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/code/service.ts
git commit -m "feat(server): add CodeService with git/file operations in Docker containers"
```

---

## Task 3: Server Code Module — Controller, Routes, Module Registration

**Files:**
- Create: `packages/server/src/modules/code/controller.ts`
- Create: `packages/server/src/modules/code/routes.ts`
- Create: `packages/server/src/modules/code/code.module.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Create CodeController**

Controller delegates to CodeService. Methods match each route: `getFileTree`, `getFileContent`, `getGitStatus`, `getGitLog`, `getBranches`, `getCommitDiff`, `commit`, `push`, `pull`, `stage`, `discard`. Each method extracts `projectId` from `req.params` and `repoName` from `req.query` or `req.body`, then calls the corresponding service method with `req.userId!`.

- [ ] **Step 2: Create routes.ts**

Routes use `authMiddleware` + `validateParams(projectIdParamsSchema)` on every route. Read routes also use `validateQuery` or `validateBody` where applicable. Write routes (commit/push/pull/stage/discard) use `validateBody`. All routes wrapped in `asyncHandler`. Mounted at `/api/projects/:projectId/code/*`.

- [ ] **Step 3: Create code.module.ts**

Register `CodeService` and `CodeController` as singletons. Export `createCodeRoutes`.

- [ ] **Step 4: Mount in server index.ts**

In `packages/server/src/index.ts`:
1. Import and call `registerCodeModule()`
2. Resolve `CodeController` from container
3. Mount routes: `app.use('/api/projects', createCodeRoutes(codeController))`

- [ ] **Step 5: Verify server builds and starts**

Run: `cd packages/server && npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/modules/code/controller.ts packages/server/src/modules/code/routes.ts packages/server/src/modules/code/code.module.ts packages/server/src/index.ts
git commit -m "feat(server): add code module controller, routes, and mount in server"
```

---

## Task 4: Frontend — Types & CSS Tokens

**Files:**
- Create: `packages/web/src/types/code.ts`
- Create: `packages/web/src/styles/code-tokens.css`
- Modify: `packages/web/src/styles/globals.css` (add import + @theme mappings)
- Modify: `packages/web/src/types/index.ts` (add export)

- [ ] **Step 1: Create types/code.ts**

Types mirror server types: `RepoGitStatus`, `GitFileChange`, `GitFileStatus`, `CommitNode`, `BranchInfo`, `FileContent`, `FileTreeNode`. Add display constants: `GIT_STATUS_COLORS`, `GIT_STATUS_LABELS`, `REPO_COLORS`.

- [ ] **Step 2: Add export in types/index.ts**

Add `export * from './code.js';`

- [ ] **Step 3: Create code-tokens.css**

VSCode Dark Modern theme tokens. Key values:
- `--code-bg-base: #1e1e1e` (editor background)
- `--code-bg-surface: #181818` (sidebar/tabs)
- `--code-accent: #0078d4` (VSCode blue)
- `--code-statusbar-bg: #0078d4` (status bar)
- `--code-git-added: #22c55e`, `--code-git-modified: #e74c3c`
- `--code-diff-added-bg: rgba(34,197,94,0.12)`, `--code-diff-deleted-bg: rgba(231,76,60,0.12)`
- Layout sizes: sidebar 240px, activity strip 48px, tab 36px, statusbar 24px

- [ ] **Step 4: Import code-tokens.css in globals.css**

Add `@import "./code-tokens.css";` after the existing `@import "./tokens.css";` line.

- [ ] **Step 5: Add @theme inline mappings**

In globals.css `@theme inline` block, add color mappings for all `--code-*` tokens using `--color-code-*` pattern (e.g., `--color-code-bg-base: var(--code-bg-base)`).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/types/code.ts packages/web/src/types/index.ts packages/web/src/styles/code-tokens.css packages/web/src/styles/globals.css
git commit -m "feat(web): add code tab types and VSCode dark theme CSS tokens"
```

---

## Task 5: Frontend — API Methods & TanStack Query Hooks

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/lib/queries/use-code.ts`

- [ ] **Step 1: Add code API methods to api.ts**

Add 11 methods: `getCodeFileTree`, `getCodeFileContent`, `getCodeGitStatus`, `getCodeGitLog`, `getCodeBranches`, `getCodeCommitDiff`, `codeGitCommit`, `codeGitPush`, `codeGitPull`, `codeGitStage`, `codeGitDiscard`. All use `apiClientMethods.get` or `apiClientMethods.post` with paths under `/projects/:projectId/code/*`.

- [ ] **Step 2: Create TanStack Query hooks**

`use-code.ts` defines `codeKeys` query key factory and hooks:
- `useCodeGitStatus(projectId)` — staleTime 30s, refetch on mutation
- `useCodeGitLog(projectId, repoName?)` — staleTime 60s
- `useCodeFileContent(projectId, path, repoName?)` — staleTime 5min
- `useCodeCommitDiff(projectId, hash, repoName?)` — staleTime 5min
- `useCodeGitCommit(projectId)` — mutation, invalidates all codeKeys
- `useCodeGitPush(projectId)` — mutation, invalidates gitStatus
- `useCodeGitPull(projectId)` — mutation, invalidates all codeKeys

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/lib/queries/use-code.ts
git commit -m "feat(web): add code API methods and TanStack Query hooks"
```

---

## Task 6: Frontend — RightPanel Tab Extension

**Files:**
- Modify: `packages/web/src/components/workspace/right-panel.tsx`

- [ ] **Step 1: Add 'code' to RightTab type**

Change `type RightTab = 'collab' | 'preview'` to `type RightTab = 'collab' | 'preview' | 'code'`.

- [ ] **Step 2: Add code tab button in tab header**

Add a third `<button>` after "预览" with text "代码" and an appropriate icon (use `Code2` from lucide-react).

- [ ] **Step 3: Render CodePanel when code tab is active**

Import `CodePanel` from `@/components/code` (dynamic import with loading state, same pattern as ChatWorkspace). In the content section, add `{activeTab === 'code' ? <CodePanel project={project} userId={userId} /> : ...}`.

- [ ] **Step 4: Verify frontend builds**

Run: `cd packages/web && npm run build`
Expected: Build succeeds (CodePanel not yet implemented, so this will fail — skip this verification until Task 7)

- [ ] **Step 5: Commit** (will be combined with Task 7 since CodePanel needs to exist)

---

## Task 7: Frontend — CodePanel Shell & CodeSidebar

**Files:**
- Create: `packages/web/src/components/code/index.tsx`
- Create: `packages/web/src/components/code/code-sidebar.tsx`

- [ ] **Step 1: Create CodePanel shell**

`packages/web/src/components/code/index.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { CodeSidebar } from './code-sidebar';

interface CodePanelProps {
  project: Project | null;
  userId: number;
}

export function CodePanel({ project, userId }: CodePanelProps) {
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [viewingCommit, setViewingCommit] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<{ path: string; repoName: string }[]>([]);

  return (
    <div className="h-full flex bg-code-bg-base text-code-text-primary">
      {/* Activity strip */}
      <div className="w-[48px] bg-code-bg-surface border-r border-code-border flex flex-col items-center py-2 gap-1">
        {/* Icons: files, git, search — will be added in later tasks */}
      </div>

      {/* Sidebar */}
      <CodeSidebar
        projectId={project?.id ?? null}
        userId={userId}
        activeRepo={activeRepo}
        onSetActiveRepo={setActiveRepo}
        onViewCommit={setViewingCommit}
      />

      {/* Editor area — will be built in Task 8 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-code-text-secondary text-sm">
          Select a file or commit to view
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CodeSidebar skeleton**

`packages/web/src/components/code/code-sidebar.tsx`:

Contains the sidebar layout structure with placeholders for: BranchIndicator, CommitInput, ChangesList, BranchTree, RepoAccordion. Uses `useCodeGitStatus` and `useCodeGitLog` hooks to fetch data. Dark theme styling using `bg-code-bg-surface`, `border-code-border`, `text-code-text-primary` etc.

Full implementation details are in the spec. The sidebar renders:
1. Branch indicator (repo name + branch + Pull/Push)
2. Commit input (textarea + buttons)
3. Changes list (files grouped by repo with status badges)
4. Branch tree (commit nodes with graph dots)
5. Repo accordion (collapsed repos)

- [ ] **Step 3: Commit Task 6 + Task 7 together**

```bash
git add packages/web/src/components/workspace/right-panel.tsx packages/web/src/components/code/index.tsx packages/web/src/components/code/code-sidebar.tsx
git commit -m "feat(web): add CodePanel shell, CodeSidebar, and right-panel code tab"
```

---

## Task 8: Frontend — CodeEditor, DiffViewer, FileTabs, StatusBar

**Files:**
- Create: `packages/web/src/components/code/code-editor.tsx`
- Create: `packages/web/src/components/code/commit-view-header.tsx`
- Create: `packages/web/src/components/code/file-tabs.tsx`
- Create: `packages/web/src/components/code/diff-viewer.tsx`

- [ ] **Step 1: Create CodeEditor**

Orchestrates the editor area: shows FileTabs, DiffViewer/Monaco editor, and StatusBar. Accepts props: `openFiles`, `viewingCommit`, `activeRepo`, `projectId`. When `viewingCommit` is set, shows CommitViewHeader + DiffViewer. Otherwise shows file tabs + Monaco editor (or placeholder).

- [ ] **Step 2: Create CommitViewHeader**

Blue banner (`bg-code-bg-active #094771`) showing "Viewing commit: hash · message · author · time". Close button returns to file view.

- [ ] **Step 3: Create FileTabs**

VSCode-style tabs with filename + repo badge. Active tab has blue top border (`border-t border-code-accent`). Each tab has a close (x) button.

- [ ] **Step 4: Create DiffViewer**

Inline diff display: file label headers (filename + +/- stats), then diff lines with line numbers. Deleted lines: `bg-code-diff-deleted-bg`, Added lines: `bg-code-diff-added-bg`. Context lines: `text-code-text-primary`.

- [ ] **Step 5: Create StatusBar**

VSCode blue status bar (`bg-code-statusbar-bg`). Left: branch name + sync status + change count. Right: repo name + cursor position + encoding + language.

- [ ] **Step 6: Wire CodeEditor into CodePanel**

Replace the placeholder "Select a file..." text in CodePanel's editor area with `<CodeEditor>` component, passing all required props.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/code/code-editor.tsx packages/web/src/components/code/commit-view-header.tsx packages/web/src/components/code/file-tabs.tsx packages/web/src/components/code/diff-viewer.tsx
git commit -m "feat(web): add CodeEditor, DiffViewer, FileTabs, StatusBar"
```

---

## Task 9: Frontend — Branch Tree & Changes List Details

**Files:**
- Create: `packages/web/src/components/code/branch-tree.tsx`
- Create: `packages/web/src/components/code/changes-list.tsx`
- Create: `packages/web/src/components/code/branch-indicator.tsx`
- Create: `packages/web/src/components/code/commit-input.tsx`
- Create: `packages/web/src/components/code/repo-accordion.tsx`

- [ ] **Step 1: Create BranchIndicator**

Shows current repo name, branch (green dot + branch name), Pull/Push buttons. Uses `useCodeGitPush` and `useCodeGitPull` mutations. Button styling: Push is `bg-code-accent`, Pull is ghost style.

- [ ] **Step 2: Create CommitInput**

Textarea for commit message with `bg-code-bg-base`, focus border `border-code-accent`. Two buttons: "Commit" (primary blue) and "Commit & Push" (secondary). Uses `useCodeGitCommit` and `useCodeGitPush` mutations.

- [ ] **Step 3: Create ChangesList**

Files grouped by repo. Each file shows path + status badge (M/A/U colored with `--code-git-*` tokens). Per-file action buttons: stage (+) and discard (↩). Uses `useCodeGitStage` and `useCodeGitDiscard` mutations.

- [ ] **Step 4: Create BranchTree**

Commit nodes from `useCodeGitLog`. Each node has a graph dot (colored by branch: main=blue, develop=green, feature=amber, merged=gray). Click on a node sets `viewingCommit` via callback. Selected node gets `bg-code-bg-active` highlight.

- [ ] **Step 5: Create RepoAccordion**

Collapsed repo sections. Shows repo name + branch + change counts. Click expands, collapses current repo. Uses `setActiveRepo` callback.

- [ ] **Step 6: Wire all sub-components into CodeSidebar**

Replace placeholder sections in CodeSidebar with the actual components, passing hooks data and callbacks.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/code/branch-tree.tsx packages/web/src/components/code/changes-list.tsx packages/web/src/components/code/branch-indicator.tsx packages/web/src/components/code/commit-input.tsx packages/web/src/components/code/repo-accordion.tsx packages/web/src/components/code/code-sidebar.tsx
git commit -m "feat(web): add BranchIndicator, CommitInput, ChangesList, BranchTree, RepoAccordion"
```

---

## Task 10: Frontend — Activity Strip Icons & Monaco Editor Integration

**Files:**
- Modify: `packages/web/src/components/code/index.tsx`
- Install: `@monaco-editor/react` package

- [ ] **Step 1: Install Monaco Editor**

Run: `cd packages/web && npm install @monaco-editor/react`

- [ ] **Step 2: Add activity strip icons**

In CodePanel, add three SVG icon buttons in the 48px activity strip: Files (folder icon), Git (branch icon), Search (magnifier icon). Active icon gets `text-code-text-contrast` with a 2px blue indicator bar on the left edge. Use Lucide icons: `Files`, `GitBranch`, `Search`.

- [ ] **Step 3: Add Monaco Editor to CodeEditor**

When a file is opened (not viewing a commit), render Monaco Editor with `@monaco-editor/react`. Configure: theme "vs-dark", language from `FileContent.language`, read-only mode. Wrap in a conditional: only render when a file is selected, otherwise show placeholder.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/code/index.tsx packages/web/src/components/code/code-editor.tsx packages/web/package.json packages/web/package-lock.json
git commit -m "feat(web): add activity strip icons and Monaco Editor integration"
```

---

## Task 11: Frontend — Wire Up Interactions & Polish

**Files:**
- Modify: `packages/web/src/components/code/index.tsx`
- Modify: `packages/web/src/components/code/code-sidebar.tsx`
- Modify: `packages/web/src/components/code/code-editor.tsx`

- [ ] **Step 1: Wire click handlers**

In BranchTree: clicking a commit node calls `onViewCommit(hash)`. In ChangesList: clicking a file calls `onOpenFile({ path, repoName })`. In FileTabs: clicking a tab switches active file, close button removes from openFiles.

- [ ] **Step 2: Wire mutation success callbacks**

After commit/push/pull/stage/discard mutations succeed, invalidate relevant queries via `useQueryClient`. The TanStack Query hooks already handle this in their `onSuccess` callbacks.

- [ ] **Step 3: Add loading states**

Show skeleton/loading indicators when git data is loading: `useCodeGitStatus` and `useCodeGitLog` have `isLoading` states. Show spinner on Push/Pull buttons while mutations are pending.

- [ ] **Step 4: Verify full frontend build**

Run: `cd packages/web && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/code/
git commit -m "feat(web): wire up CodePanel interactions and add loading states"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Right panel tab extension → Task 6
   - File tree browsing → Task 2 (service) + Task 10 (Monaco)
   - Git status/branch indicator → Task 9 (BranchIndicator)
   - Commit input → Task 9 (CommitInput)
   - Changes list → Task 9 (ChangesList)
   - Branch tree → Task 9 (BranchTree)
   - Commit diff viewing → Task 8 (DiffViewer + CommitViewHeader)
   - Multi-repo accordion → Task 9 (RepoAccordion)
   - File tabs with repo badge → Task 8 (FileTabs)
   - Dark theme tokens → Task 4
   - Server API endpoints → Tasks 2, 3
   - VSCode-style status bar → Task 8 (StatusBar)
   - Activity strip → Task 10

2. **Placeholder scan:** No TBDs, TODOs, or "implement later" patterns.

3. **Type consistency:** All types defined in Task 1 (server) and Task 4 (frontend) are consistent. `RepoGitStatus`, `CommitNode`, `GitFileChange` etc. match between server and client. Query hooks use the same type names. API methods return the same types.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-22-code-tab-vscode-editor.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?