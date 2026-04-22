# Code Tab — VSCode-like Web Editor Design Spec

**Date:** 2026-04-22
**Status:** Approved

## Overview

Add a "代码" (Code) tab to the right panel, alongside the existing "协作" (Collaboration) and "预览" (Preview) tabs. The Code tab provides a VSCode-like web editor with file browsing, code viewing/diff, git branch tree, commit history, and git operations (commit, push, pull).

## Architecture

### Right Panel Extension

The `RightPanel` component (`workspace/right-panel.tsx`) gains a third tab:

```
RightTab = 'collab' | 'preview' | 'code'
```

The Code tab is a self-contained component `CodePanel` that handles its own state and rendering.

### Component Structure

```
CodePanel
├── CodeSidebar          (left: ~200px, resizable)
│   ├── SidePanelTabs    (Files | Git | Search)
│   ├── BranchIndicator  (current repo + branch + Pull/Push)
│   ├── CommitInput      (commit message + Commit/Commit&Push buttons)
│   ├── ChangesList      (grouped by repo, per-file status + stage/discard)
│   ├── BranchTree       (visual branch topology + commit nodes)
│   └── RepoAccordion    (expand/collapse per-repo sections)
│
└── CodeEditor           (right: flex-1)
    ├── FileTabs          (open file tabs with repo tag)
    ├── DiffViewer        (inline diff view for selected commit/file)
    └── StatusBar         (repo + branch + cursor info)
```

### Data Flow

- **File tree & content**: Server API reads files from the project's Docker container filesystem
- **Git data**: Server API executes git commands inside the container (status, log, diff, branch list)
- **Git operations**: Server API executes commit/push/pull inside the container
- **WebSocket**: Not needed for the code tab; all data fetched via REST API

## Features

### 1. Side Panel — Files View

- File tree browsable by directory
- Click file → opens in editor (read-only or editable, TBD)
- Each repo root shown as a top-level folder

### 2. Side Panel — Git View

**Branch Indicator (top)**:
- Shows current repo name + branch name
- Pull / Push buttons inline

**Commit Input**:
- Text input for commit message
- "Commit" button (commits staged changes)
- "Commit & Push" button (commits + pushes)

**Changes List**:
- Grouped by repo
- Per file: status badge (M = modified, A = added, D = deleted)
- Per file actions: stage (✓+), unstage, discard (↩)

**Branch Tree**:
- Visual branch topology (vertical timeline with branch/merge lines)
- Each node is a commit (hash + message + timestamp)
- Current branch highlighted with accent color
- Other branches shown with different colors
- Merged branches labeled "merged"
- Click a commit node → editor switches to diff view for that commit

### 3. Code Editor / Diff Viewer

**Normal mode**: Shows file content with syntax highlighting (Monaco Editor or CodeMirror)

**Commit diff mode** (when a commit is clicked in branch tree):
- Header shows "Viewing commit: [hash] [message]"
- Shows diff for each changed file in that commit
- Color-coded: red for deletions, green for additions
- "Close" button returns to normal file view

**File tabs**:
- Each tab shows filename + repo tag (colored badge: FE/BE/SH or repo name)
- Click tab → switches to that file

### 4. Multi-Repo Handling

All repos' changes are visible in one view:
- Current (active) repo section is expanded in the sidebar
- Other repos shown as collapsed accordions
- Click accordion → expands that repo, collapses the current one
- Editor tabs include repo context tags
- Bottom status bar shows active repo + branch

## Visual Design

### Color Tokens — Code Tab (Dark Theme)

The app's main design system is warm/light. The code tab uses a dark theme (VSCode-style) for readability. These tokens extend the existing `tokens.css`:

```css
:root {
  /* ─── Code Tab · Dark theme background ─────────────────────── */
  --code-bg-base:       #1e1e2e;
  --code-bg-surface:    #252536;
  --code-bg-elevated:   #2d2d3f;
  --code-bg-active:     #3c3c50;
  --code-bg-hover:      #33334a;

  /* ─── Code Tab · Accent ──────────────────────────────────────── */
  --code-accent:        #7c3aed;   /* violet-600 — matches accent-primary vibe */
  --code-accent-hover:  #6d28d9;

  /* ─── Code Tab · Text ────────────────────────────────────────── */
  --code-text-primary:  #e0e0e0;
  --code-text-secondary: #b0b0b0;
  --code-text-muted:    #888888;

  /* ─── Code Tab · Border ──────────────────────────────────────── */
  --code-border:        #444444;
  --code-border-light:  #333333;

  /* ─── Code Tab · Git status colors ──────────────────────────── */
  --code-git-added:     #73c991;   /* green — new files/lines */
  --code-git-modified:  #f14c4c;   /* red — changed files/lines */
  --code-git-deleted:   #f14c4c;   /* red — deleted lines */
  --code-git-renamed:   #e2c08d;   /* amber — renamed files */
  --code-git-untracked: #569cd6;   /* blue — untracked files */

  /* ─── Code Tab · Repo tag colors ────────────────────────────── */
  --code-repo-1:        #7c3aed;   /* violet — primary repo */
  --code-repo-2:        #569cd6;   /* blue — secondary repo */
  --code-repo-3:        #e2c08d;   /* amber — third repo */

  /* ─── Code Tab · Diff background ─────────────────────────────── */
  --code-diff-added-bg:   #1e3a1e;
  --code-diff-deleted-bg: #2d2040;
}
```

### Layout Spacing

- Sidebar width: 200px (default, min 160px)
- Tab header: 40px height (matches existing right-panel tab bar)
- Branch indicator: ~48px height
- Commit input: ~80px height (input + buttons)
- Branch tree node: ~24px per commit row
- File tab: ~32px height
- Status bar: ~28px height
- Scrollbar: 6px width (matches globals.css setting)

### Typography

- File names in sidebar: 9-10px, `font-sans`
- Code content: 10-13px, `font-mono`
- Commit messages in tree: 9px, `font-sans`
- Commit hash: 9px, `font-mono`
- Tab labels: 13px, `font-semibold` (matches existing)
- Buttons: 9-10px, `font-sans`

### Branch Tree Visual Style

- Vertical line for each branch (2px width, branch color)
- Circle nodes at commits (8px diameter, filled with branch color)
- Merge lines shown as horizontal connectors from branch line to main line
- Current HEAD commit: accent border highlight
- Branch label inline with HEAD commit node
- Merged branch labels: italic + "merged" badge + muted color

## Server API Endpoints (New)

```
GET  /api/projects/:projectId/code/tree          — file tree
GET  /api/projects/:projectId/code/file?path=    — file content
GET  /api/projects/:projectId/code/git/status    — git status (all repos)
GET  /api/projects/:projectId/code/git/log       — commit history (branch tree)
GET  /api/projects/:projectId/code/git/diff?commit= — diff for a commit
GET  /api/projects/:projectId/code/git/branches  — branch list
POST /api/projects/:projectId/code/git/commit    — commit staged changes
POST /api/projects/:projectId/code/git/push      — push to remote
POST /api/projects/:projectId/code/git/pull      — pull from remote
POST /api/projects/:projectId/code/git/stage     — stage files
POST /api/projects/:projectId/code/git/unstage   — unstage files
POST /api/projects/:projectId/code/git/discard   — discard changes
```

All endpoints execute commands inside the project's Docker container via Dockerode.

## Component Interfaces

```typescript
// CodePanel props
interface CodePanelProps {
  project: Project | null;
}

// GitStatus per repo
interface RepoGitStatus {
  repoName: string;
  branch: string;
  files: {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
    staged: boolean;
  }[];
  ahead: number;
  behind: number;
}

// Branch tree node
interface CommitNode {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  branch: string;
  isHead: boolean;
  isMerge: boolean;
  parentHashes: string[];
  mergeFrom?: string; // branch name if this is a merge commit
}

// File content
interface FileContent {
  path: string;
  content: string;
  language: string;
  repoName: string;
}
```

## What's NOT in Scope (YAGNI)

- File editing / saving (read-only + diff view only for MVP)
- Branch creation / switching
- Conflict resolution
- Remote branch management beyond push/pull
- Code search (Search tab placeholder only)
- Terminal integration (already handled by ChatWorkspace)
- Multi-user real-time code editing

## Out of Scope — Future Considerations

- Editable files with save → auto-commit workflow
- Branch switching UI
- Code review annotations in diff view
- AI-assisted code explanation (Claude integration)