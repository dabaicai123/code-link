# Code Tab — VSCode-like Web Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "代码" tab to the right panel with file browsing, code/diff viewing, git branch tree, commit history, and git operations (commit/push/pull).

**Architecture:** New `code` server module handles git/file operations inside Docker containers. New frontend `CodePanel` component replaces the right panel's third tab area with a dark-themed VSCode-style interface: left sidebar (branch indicator, commit input, changes list, branch tree) + right editor (file tabs, diff viewer, status bar).

**Tech Stack:** Express.js + Dockerode (server), React + TanStack Query + Monaco Editor (frontend), Tailwind CSS v4 + CSS custom properties (styling)

---

## File Structure

### Server — New Module

| File | Responsibility |
|------|---------------|
| `packages/server/src/modules/code/code.module.ts` | DI registration + barrel exports |
| `packages/server/src/modules/code/routes.ts` | Express router factory for `/api/projects/:projectId/code/*` |
| `packages/server/src/modules/code/controller.ts` | Request handlers — extracts params, calls service |
| `packages/server/src/modules/code/service.ts` | Business logic — runs git/file commands in container |
| `packages/server/src/modules/code/schemas.ts` | Zod validation schemas |
| `packages/server/src/modules/code/types.ts` | Domain types (RepoGitStatus, CommitNode, FileContent) |

### Server — Modified

| File | Change |
|------|--------|
| `packages/server/src/index.ts` | Register code module, mount routes at `/api/projects/:projectId/code` |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `packages/web/src/types/code.ts` | TypeScript types for code tab data |
| `packages/web/src/lib/queries/use-code.ts` | TanStack Query hooks for git/file data |
| `packages/web/src/lib/api.ts` (modified) | Add code API methods |
| `packages/web/src/components/code/index.tsx` | CodePanel — main orchestrator |
| `packages/web/src/components/code/code-sidebar.tsx` | Left sidebar with branch indicator, commit input, changes, branch tree |
| `packages/web/src/components/code/branch-indicator.tsx` | Current repo + branch display with Pull/Push buttons |
| `packages/web/src/components/code/commit-input.tsx` | Commit message textarea + Commit/Commit&Push buttons |
| `packages/web/src/components/code/changes-list.tsx` | Changed files grouped by repo with stage/discard actions |
| `packages/web/src/components/code/branch-tree.tsx` | Visual commit history with branch topology |
| `packages/web/src/components/code/code-editor.tsx` | Editor area with file tabs, diff viewer, status bar |
| `packages/web/src/components/code/commit-view-header.tsx` | Banner showing which commit is being viewed |
| `packages/web/src/components/code/file-tabs.tsx` | Open file tabs with repo badge |
| `packages/web/src/components/code/diff-viewer.tsx` | Inline diff display for commit/file diffs |
| `packages/web/src/components/code/repo-accordion.tsx` | Collapsed repo sections for multi-repo |
| `packages/web/src/styles/code-tokens.css` | Dark theme CSS custom properties for code tab |

### Frontend — Modified

| File | Change |
|------|--------|
| `packages/web/src/styles/tokens.css` | Import code-tokens.css |
| `packages/web/src/styles/globals.css` | Add code theme mappings to @theme inline |
| `packages/web/src/components/workspace/right-panel.tsx` | Add 'code' tab to RightTab union, render CodePanel |
| `packages/web/src/types/index.ts` | Export code types |

---

## Task 1: Server Code Module — Types & Schemas

**Files:**
- Create: `packages/server/src/modules/code/types.ts`
- Create: `packages/server/src/modules/code/schemas.ts`

- [ ] **Step 1: Create types.ts with domain types**

```typescript
// packages/server/src/modules/code/types.ts

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

export interface CommitInput {
  message: string;
  repoName?: string;
}

export interface StageInput {
  repoName: string;
  paths: string[];
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

- [ ] **Step 2: Create schemas.ts with Zod validation**

```typescript
// packages/server/src/modules/code/schemas.ts

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

export type CommitBodyInput = z.infer<typeof commitBodySchema>;
export type StageBodyInput = z.infer<typeof stageBodySchema>;
export type DiscardBodyInput = z.infer<typeof discardBodySchema>;
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

- [ ] **Step 1: Create CodeService that executes git/file commands inside Docker containers**

The service uses the existing `DockerService` to exec commands in the project's container. For MVP, a project has one container with potentially multiple git repos. The service parses git command output into structured types.

```typescript
// packages/server/src/modules/code/service.ts

import { singleton, inject } from 'tsyringe';
import { DockerService } from '../container/lib/docker.service.js';
import { ContainerRepository } from '../container/repository.js';
import { PermissionService } from '../auth/permission.service.js';
import { NotFoundError } from '../../core/errors/index.js';
import type {
  RepoGitStatus, GitFileChange, CommitNode, BranchInfo,
  FileContent, FileTreeNode, GitExecResult,
} from './types.js';

@singleton()
export class CodeService {
  constructor(
    @inject(DockerService) private readonly docker: DockerService,
    @inject(ContainerRepository) private readonly containerRepo: ContainerRepository,
    @inject(PermissionService) private readonly permission: PermissionService,
  ) {}

  private async getContainerId(userId: number, projectId: number): Promise<string> {
    await this.permission.checkProjectAccess(userId, projectId);
    const container = await this.containerRepo.findByProjectId(projectId);
    if (!container?.containerId) throw new NotFoundError('容器');
    return container.containerId;
  }

  private async execGit(containerId: string, args: string[], workDir?: string): Promise<GitExecResult> {
    const command = workDir
      ? ['sh', '-c', `cd ${workDir} && git ${args.join(' ')}`]
      : ['git', ...args];
    const result = await this.docker.execInContainer(containerId, command);
    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(`Git command failed: ${result.stderr}`);
    }
    return result;
  }

  // ─── File operations ────────────────────────────────────────

  async getFileTree(userId: number, projectId: number, repoName?: string): Promise<FileTreeNode[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.docker.execInContainer(containerId, [
      'sh', '-c', `cd ${workDir} && find . -not -path './.git/*' -not -path '*/node_modules/*' | head -200`,
    ]);
    return this.parseFileTree(result.stdout);
  }

  async getFileContent(userId: number, projectId: number, path: string, repoName?: string): Promise<FileContent> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.docker.execInContainer(containerId, [
      'sh', '-c', `cat "${workDir}/${path}" | head -5000`,
    ]);
    return {
      path,
      content: result.stdout,
      language: this.detectLanguage(path),
      repoName: repoName || 'default',
    };
  }

  // ─── Git status ──────────────────────────────────────────────

  async getGitStatus(userId: number, projectId: number): Promise<RepoGitStatus[]> {
    const containerId = await this.getContainerId(userId, projectId);
    // Find all git repos in the workspace
    const reposResult = await this.docker.execInContainer(containerId, [
      'sh', '-c', 'find /home/codelink -maxdepth 2 -name .git -type d | sed "s/\\/\\.git$//"',
    ]);
    const repoPaths = reposResult.stdout.trim().split('\n').filter(Boolean);
    if (repoPaths.length === 0) return [];

    const statuses: RepoGitStatus[] = [];
    for (const repoPath of repoPaths) {
      const repoName = repoPath.split('/').pop() || 'default';
      const branchResult = await this.execGit(containerId, ['branch', '--show-current'], repoPath);
      const branch = branchResult.stdout.trim() || 'main';

      const statusResult = await this.execGit(containerId, ['status', '--porcelain=v2'], repoPath);
      const files = this.parseGitStatus(statusResult.stdout);

      const trackingResult = await this.execGit(containerId, ['rev-list', '--left-right', '--count', `${branch}...origin/${branch}`], repoPath);
      const [ahead, behind] = this.parseAheadBehind(trackingResult.stdout);

      statuses.push({ repoName, branch, files, ahead, behind });
    }
    return statuses;
  }

  // ─── Git log / branch tree ────────────────────────────────────

  async getGitLog(userId: number, projectId: number, repoName?: string): Promise<CommitNode[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : undefined;
    // Use --all to see all branches, format with structured data
    const result = await this.execGit(containerId, [
      'log', '--all', '--pretty=format:%H|%s|%an|%at|%D|%P', '--topo-order', '-50',
    ], workDir);
    return this.parseGitLog(result.stdout);
  }

  async getBranches(userId: number, projectId: number, repoName?: string): Promise<BranchInfo[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : undefined;
    const result = await this.execGit(containerId, ['branch', '-a', '--no-color'], workDir);
    return this.parseBranchList(result.stdout);
  }

  // ─── Git diff ─────────────────────────────────────────────────

  async getCommitDiff(userId: number, projectId: number, hash: string, repoName?: string): Promise<string> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : undefined;
    const result = await this.execGit(containerId, ['diff', `${hash}^!`, '--stat', '--patch'], workDir);
    return result.stdout;
  }

  // ─── Git operations ────────────────────────────────────────────

  async commit(userId: number, projectId: number, message: string, repoName?: string): Promise<{ success: boolean; hash?: string }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : undefined;
    // Stage all changes first, then commit
    await this.execGit(containerId, ['add', '-A'], workDir);
    const result = await this.execGit(containerId, ['commit', '-m', message], workDir);
    const hashMatch = result.stdout.match(/\[.*\s([a-f0-9]{7,})\]/);
    return { success: result.exitCode === 0, hash: hashMatch?.[1] };
  }

  async push(userId: number, projectId: number, repoName?: string): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : undefined;
    const result = await this.execGit(containerId, ['push'], workDir);
    return { success: result.exitCode === 0 };
  }

  async pull(userId: number, projectId: number, repoName?: string): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : undefined;
    const result = await this.execGit(containerId, ['pull'], workDir);
    return { success: result.exitCode === 0 };
  }

  async stage(userId: number, projectId: number, repoName: string, paths: string[]): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = `/home/codelink/${repoName}`;
    const result = await this.execGit(containerId, ['add', ...paths], workDir);
    return { success: result.exitCode === 0 };
  }

  async discard(userId: number, projectId: number, repoName: string, paths: string[]): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = `/home/codelink/${repoName}`;
    // checkout to discard modifications, clean for untracked
    const checkoutResult = await this.execGit(containerId, ['checkout', '--', ...paths], workDir);
    const cleanResult = await this.execGit(containerId, ['clean', '-f', ...paths], workDir);
    return { success: checkoutResult.exitCode === 0 && cleanResult.exitCode === 0 };
  }

  // ─── Private parsing helpers ──────────────────────────────────

  private parseFileTree(raw: string): FileTreeNode[] {
    const lines = raw.trim().split('\n').filter(Boolean);
    const root: FileTreeNode[] = [];
    for (const line of lines) {
      const parts = line.split('/').filter(Boolean);
      // Simplified: just return flat file list for MVP
      const isDir = !parts[parts.length - 1].includes('.');
      root.push({
        name: parts[parts.length - 1],
        path: line.replace(/^\.\//, ''),
        type: isDir ? 'directory' : 'file',
      });
    }
    return root;
  }

  private parseGitStatus(raw: string): GitFileChange[] {
    const files: GitFileChange[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      // porcelain v2 format: "1 .M N..." or "? path"
      if (line.startsWith('1 ')) {
        const xy = line.substring(2, 4);
        const path = line.split(' ').pop() || '';
        const staged = xy[0] !== '.' && xy[0] !== '?';
        const status = this.mapStatus(xy);
        files.push({ path, status, staged });
      } else if (line.startsWith('? ')) {
        files.push({ path: line.substring(2), status: 'untracked', staged: false });
      }
    }
    return files;
  }

  private mapStatus(xy: string): GitFileChange['status'] {
    const y = xy[1]; // worktree status
    if (y === 'M') return 'modified';
    if (y === 'A') return 'added';
    if (y === 'D') return 'deleted';
    if (y === 'R') return 'renamed';
    return 'modified';
  }

  private parseAheadBehind(raw: string): [number, number] {
    const parts = raw.trim().split('\t');
    return [Number(parts[0]) || 0, Number(parts[1]) || 0];
  }

  private parseGitLog(raw: string): CommitNode[] {
    const commits: CommitNode[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      const [hash, message, author, timestamp, refs, parents] = line.split('|');
      const branch = this.extractBranchFromRefs(refs);
      const isHead = refs.includes('HEAD');
      const isMerge = parents.split(' ').filter(Boolean).length > 1;
      commits.push({
        hash,
        message,
        author,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        branch,
        isHead,
        isMerge,
        parentHashes: parents.split(' ').filter(Boolean),
        mergeFrom: isMerge && refs.includes('merge') ? branch : undefined,
      });
    }
    return commits;
  }

  private extractBranchFromRefs(refs: string): string {
    // refs format: "HEAD -> main, origin/main, tag: v1"
    const match = refs.match(/HEAD -> ([^,]+)/);
    return match?.[1] || refs.split(',')[0]?.trim() || 'main';
  }

  private parseBranchList(raw: string): BranchInfo[] {
    const branches: BranchInfo[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      const isCurrent = line.startsWith('*');
      const name = line.replace(/^\* /, '').replace(/^  /, '').replace('remotes/origin/', '');
      const isRemote = line.includes('remotes/');
      branches.push({ name, isCurrent, isRemote });
    }
    return branches;
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop() || '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', css: 'css',
      html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
      sql: 'sql', sh: 'shell', bash: 'shell',
    };
    return map[ext] || 'plaintext';
  }
}
```

- [ ] **Step 2: Commit**

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

- [ ] **Step 1: Create controller.ts**

```typescript
// packages/server/src/modules/code/controller.ts

import { singleton, inject } from 'tsyringe';
import type { Request, Response } from 'express';
import { CodeService } from './service.js';
import { success } from '../../core/response.js';

@singleton()
export class CodeController {
  constructor(@inject(CodeService) private readonly service: CodeService) {}

  async getFileTree(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getFileTree(req.userId!, projectId, repoName);
    res.json(success(result));
  }

  async getFileContent(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const path = req.query.path as string;
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getFileContent(req.userId!, projectId, path, repoName);
    res.json(success(result));
  }

  async getGitStatus(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.getGitStatus(req.userId!, projectId);
    res.json(success(result));
  }

  async getGitLog(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getGitLog(req.userId!, projectId, repoName);
    res.json(success(result));
  }

  async getBranches(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getBranches(req.userId!, projectId, repoName);
    res.json(success(result));
  }

  async getCommitDiff(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const hash = req.query.hash as string;
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getCommitDiff(req.userId!, projectId, hash, repoName);
    res.json(success({ diff: result }));
  }

  async commit(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.commit(req.userId!, projectId, req.body.message, req.body.repoName);
    res.json(success(result));
  }

  async push(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.push(req.userId!, projectId, req.body.repoName);
    res.json(success(result));
  }

  async pull(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.pull(req.userId!, projectId, req.body.repoName);
    res.json(success(result));
  }

  async stage(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.stage(req.userId!, projectId, req.body.repoName, req.body.paths);
    res.json(success(result));
  }

  async discard(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.discard(req.userId!, projectId, req.body.repoName, req.body.paths);
    res.json(success(result));
  }
}
```

- [ ] **Step 2: Create routes.ts**

```typescript
// packages/server/src/modules/code/routes.ts

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateParams, validateQuery, validateBody } from '../../middleware/validation.js';
import { projectIdParamsSchema, filePathQuerySchema, commitHashQuerySchema, commitBodySchema, stageBodySchema, discardBodySchema, pushBodySchema, pullBodySchema } from './schemas.js';
import { CodeController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';

export function createCodeRoutes(controller: CodeController): Router {
  const router = Router();

  // File operations
  router.get(
    '/:projectId/code/tree',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getFileTree(req, res)),
  );
  router.get(
    '/:projectId/code/file',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateQuery(filePathQuerySchema),
    asyncHandler((req, res) => controller.getFileContent(req, res)),
  );

  // Git read operations
  router.get(
    '/:projectId/code/git/status',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getGitStatus(req, res)),
  );
  router.get(
    '/:projectId/code/git/log',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getGitLog(req, res)),
  );
  router.get(
    '/:projectId/code/git/branches',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getBranches(req, res)),
  );
  router.get(
    '/:projectId/code/git/diff',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateQuery(commitHashQuerySchema),
    asyncHandler((req, res) => controller.getCommitDiff(req, res)),
  );

  // Git write operations
  router.post(
    '/:projectId/code/git/commit',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(commitBodySchema),
    asyncHandler((req, res) => controller.commit(req, res)),
  );
  router.post(
    '/:projectId/code/git/push',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(pushBodySchema),
    asyncHandler((req, res) => controller.push(req, res)),
  );
  router.post(
    '/:projectId/code/git/pull',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(pullBodySchema),
    asyncHandler((req, res) => controller.pull(req, res)),
  );
  router.post(
    '/:projectId/code/git/stage',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(stageBodySchema),
    asyncHandler((req, res) => controller.stage(req, res)),
  );
  router.post(
    '/:projectId/code/git/discard',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(discardBodySchema),
    asyncHandler((req, res) => controller.discard(req, res)),
  );

  return router;
}
```

- [ ] **Step 3: Create code.module.ts**

```typescript
// packages/server/src/modules/code/code.module.ts

import 'reflect-metadata';
import { container } from 'tsyringe';
import { CodeService } from './service.js';
import { CodeController } from './controller.js';
import { DockerService } from '../container/lib/docker.service.js';
import { ContainerRepository } from '../container/repository.js';
import { PermissionService } from '../auth/permission.service.js';

export function registerCodeModule(): void {
  // DockerService, ContainerRepository, PermissionService are already registered by other modules
  container.registerSingleton(CodeService);
  container.registerSingleton(CodeController);
}

export { CodeService, CodeController };
export { createCodeRoutes } from './routes.js';
```

- [ ] **Step 4: Mount routes in server index.ts**

Add these lines to `packages/server/src/index.ts`:

After other `registerXxxModule()` calls, add:
```typescript
import { registerCodeModule, CodeController, createCodeRoutes } from './modules/code/code.module.js';
registerCodeModule();
```

After other controller resolution lines, add:
```typescript
const codeController = container.resolve(CodeController);
```

After other `app.use()` route mounts, add:
```typescript
app.use('/api/projects', createCodeRoutes(codeController));
```

- [ ] **Step 5: Verify server starts without errors**

Run: `cd packages/server && npm run build`
Expected: Build succeeds with no TypeScript errors

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
- Modify: `packages/web/src/styles/tokens.css`
- Modify: `packages/web/src/styles/globals.css`
- Modify: `packages/web/src/types/index.ts`

- [ ] **Step 1: Create types/code.ts**

```typescript
// packages/web/src/types/code.ts

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

export const GIT_STATUS_COLORS: Record<GitFileStatus, string> = {
  modified: 'var(--code-git-modified)',
  added: 'var(--code-git-added)',
  deleted: 'var(--code-git-modified)',
  renamed: 'var(--code-git-renamed)',
  untracked: 'var(--code-git-untracked)',
};

export const GIT_STATUS_LABELS: Record<GitFileStatus, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
};

export const REPO_COLORS = ['#0078d4', '#22c55e', '#d4a017', '#e74c3c', '#7c3aed'];
```

- [ ] **Step 2: Add code types to types/index.ts**

Add to `packages/web/src/types/index.ts`:
```typescript
export * from './code.js';
```

- [ ] **Step 3: Create code-tokens.css with VSCode dark theme**

```css
/* packages/web/src/styles/code-tokens.css */

:root {
  /* ─── Code Tab · VSCode Dark Modern ─────────────────────────── */
  --code-bg-base:       #1e1e1e;
  --code-bg-surface:    #181818;
  --code-bg-elevated:   #2d2d2d;
  --code-bg-active:     #094771;
  --code-bg-hover:      #2a2a2a;

  /* ─── Code Tab · Accent ────────────────────────────────────── */
  --code-accent:        #0078d4;
  --code-accent-hover:  #1a8ad4;

  /* ─── Code Tab · Status bar ────────────────────────────────── */
  --code-statusbar-bg:  #0078d4;

  /* ─── Code Tab · Text ──────────────────────────────────────── */
  --code-text-primary:  #cccccc;
  --code-text-secondary: #808080;
  --code-text-muted:    #4f4f4f;
  --code-text-contrast: #ffffff;

  /* ─── Code Tab · Border ──────────────────────────────────────── */
  --code-border:        #3c3c3c;
  --code-border-light:  #2d2d2d;

  /* ─── Code Tab · Git status colors ──────────────────────────── */
  --code-git-added:     #22c55e;
  --code-git-modified:  #e74c3c;
  --code-git-deleted:   #e74c3c;
  --code-git-renamed:   #d4a017;
  --code-git-untracked: #0078d4;

  /* ─── Code Tab · Branch colors ──────────────────────────────── */
  --code-branch-main:   #0078d4;
  --code-branch-develop: #22c55e;
  --code-branch-feature: #d4a017;
  --code-branch-merged: #808080;

  /* ─── Code Tab · Diff background ─────────────────────────────── */
  --code-diff-added-bg:   rgba(34,197,94,0.12);
  --code-diff-deleted-bg: rgba(231,76,60,0.12);

  /* ─── Code Tab · Sizes ──────────────────────────────────────── */
  --code-sidebar-width: 240px;
  --code-activity-strip-width: 48px;
  --code-tab-height: 36px;
  --code-statusbar-height: 24px;
}
```

- [ ] **Step 4: Import code-tokens.css in tokens.css**

Add at the top of `packages/web/src/styles/tokens.css`, after the opening comment block, before `:root {`:
```css
@import "./code-tokens.css";
```

Wait — `tokens.css` doesn't use @import since globals.css imports it. Instead, add the import in `globals.css`.

In `packages/web/src/styles/globals.css`, after `@import "./tokens.css";`, add:
```css
@import "./code-tokens.css";
```

- [ ] **Step 5: Add code theme mappings in globals.css @theme inline**

In `packages/web/src/styles/globals.css`, inside the `@theme inline` block, after the existing typography mappings, add:

```css
  /* ─── Code Tab · Dark theme ─────────────────────────────────── */
  --color-code-bg-base:       var(--code-bg-base);
  --color-code-bg-surface:    var(--code-bg-surface);
  --color-code-bg-elevated:   var(--code-bg-elevated);
  --color-code-bg-active:     var(--code-bg-active);
  --color-code-bg-hover:      var(--code-bg-hover);
  --color-code-accent:        var(--code-accent);
  --color-code-accent-hover:  var(--code-accent-hover);
  --color-code-text-primary:  var(--code-text-primary);
  --color-code-text-secondary: var(--code-text-secondary);
  --color-code-text-muted:    var(--code-text-muted);
  --color-code-text-contrast: var(--code-text-contrast);
  --color-code-border:        var(--code-border);
  --color-code-border-light:  var(--code-border-light);
  --color-code-git-added:     var(--code-git-added);
  --color-code-git-modified:  var(--code-git-modified);
  --color-code-git-untracked: var(--code-git-untracked);
  --color-code-diff-added-bg: var(--code-diff-added-bg);
  --color-code-diff-deleted-bg: var(--code-diff-deleted-bg);
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/types/code.ts packages/web/src/types/index.ts packages/web/src/styles/code-tokens.css packages/web/src/styles/tokens.css packages/web/src/styles/globals.css
git commit -m "feat(web): add code tab types and VSCode dark theme CSS tokens"
```

---

## Task 5: Frontend — API Methods & TanStack Query Hooks

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/lib/queries/use-code.ts`

- [ ] **Step 1: Add code API methods to api.ts**

Add to `packages/web/src/lib/api.ts`:

```typescript
  // ─── Code tab ────────────────────────────────────────────────
  getCodeFileTree: (projectId: number, repoName?: string) =>
    apiClientMethods.get<FileTreeNode[]>(`/projects/${projectId}/code/tree${repoName ? `?repoName=${repoName}` : ''}`),

  getCodeFileContent: (projectId: number, path: string, repoName?: string) =>
    apiClientMethods.get<FileContent>(`/projects/${projectId}/code/file?path=${encodeURIComponent(path)}${repoName ? `&repoName=${repoName}` : ''}`),

  getCodeGitStatus: (projectId: number) =>
    apiClientMethods.get<RepoGitStatus[]>(`/projects/${projectId}/code/git/status`),

  getCodeGitLog: (projectId: number, repoName?: string) =>
    apiClientMethods.get<CommitNode[]>(`/projects/${projectId}/code/git/log${repoName ? `?repoName=${repoName}` : ''}`),

  getCodeBranches: (projectId: number, repoName?: string) =>
    apiClientMethods.get<BranchInfo[]>(`/projects/${projectId}/code/git/branches${repoName ? `?repoName=${repoName}` : ''}`),

  getCodeCommitDiff: (projectId: number, hash: string, repoName?: string) =>
    apiClientMethods.get<{ diff: string }>(`/projects/${projectId}/code/git/diff?hash=${hash}${repoName ? `&repoName=${repoName}` : ''}`),

  codeGitCommit: (projectId: number, message: string, repoName?: string) =>
    apiClientMethods.post<{ success: boolean; hash?: string }>(`/projects/${projectId}/code/git/commit`, { message, repoName }),

  codeGitPush: (projectId: number, repoName?: string) =>
    apiClientMethods.post<{ success: boolean }>(`/projects/${projectId}/code/git/push`, { repoName }),

  codeGitPull: (projectId: number, repoName?: string) =>
    apiClientMethods.post<{ success: boolean }>(`/projects/${projectId}/code/git/pull`, { repoName }),

  codeGitStage: (projectId: number, repoName: string, paths: string[]) =>
    apiClientMethods.post<{ success: boolean }>(`/projects/${projectId}/code/git/stage`, { repoName, paths }),

  codeGitDiscard: (projectId: number, repoName: string, paths: string[]) =>
    apiClientMethods.post<{ success: boolean }>(`/projects/${projectId}/code/git/discard`, { repoName, paths }),
```

Make sure the type imports at the top of api.ts include the code types:
```typescript
import type { RepoGitStatus, CommitNode, BranchInfo, FileContent, FileTreeNode } from '@/types/code';
```

- [ ] **Step 2: Create TanStack Query hooks in use-code.ts**

```typescript
// packages/web/src/lib/queries/use-code.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RepoGitStatus, CommitNode, BranchInfo, FileContent, FileTreeNode } from '@/types/code';

export const codeKeys = {
  all: ['code'] as const,
  gitStatus: (projectId: number) => [...codeKeys.all, 'gitStatus', projectId] as const,
  gitLog: (projectId: number, repoName?: string) => [...codeKeys.all, 'gitLog', projectId, repoName] as const,
  branches: (projectId: number, repoName?: string) => [...codeKeys.all, 'branches', projectId, repoName] as const,
  fileTree: (projectId: number, repoName?: string) => [...codeKeys.all, 'fileTree', projectId, repoName] as const,
  fileContent: (projectId: number, path: string, repoName?: string) => [...codeKeys.all, 'fileContent', projectId, path, repoName] as const,
  commitDiff: (projectId: number, hash: string, repoName?: string) => [...codeKeys.all, 'commitDiff', projectId, hash, repoName] as const,
};

export function useCodeGitStatus(projectId: number | null) {
  return useQuery({
    queryKey: codeKeys.gitStatus(projectId ?? 0),
    queryFn: () => api.getCodeGitStatus(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCodeGitLog(projectId: number | null, repoName?: string) {
  return useQuery({
    queryKey: codeKeys.gitLog(projectId ?? 0, repoName),
    queryFn: () => api.getCodeGitLog(projectId!, repoName),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useCodeFileContent(projectId: number | null, path: string | null, repoName?: string) {
  return useQuery({
    queryKey: codeKeys.fileContent(projectId ?? 0, path ?? '', repoName),
    queryFn: () => api.getCodeFileContent(projectId!, path!, repoName),
    enabled: !!projectId && !!path,
    staleTime: 300_000,
  });
}

export function useCodeCommitDiff(projectId: number | null, hash: string | null, repoName?: string) {
  return useQuery({
    queryKey: codeKeys.commitDiff(projectId ?? 0, hash ?? '', repoName),
    queryFn: () => api.getCodeCommitDiff(projectId!, hash!, repoName),
    enabled: !!projectId && !!hash,
    staleTime: 300_000,
  });
}

export function useCodeGitCommit(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { message: string; repoName?: string }) =>
      api.codeGitCommit(projectId, data.message, data.repoName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}

export function useCodeGitPush(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName?: string }) => api.codeGitPush(projectId, data.repoName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.gitStatus(projectId) });
    },
  });
}

export function useCodeGitPull(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName?: string }) => api.codeGitPull(projectId, data.repoName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}

export function useCodeGitStage(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName: string; paths: string[] }) =>
      api.codeGitStage(projectId, data.repoName, data.paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.gitStatus(projectId) });
    },
  });
}

export function useCodeGitDiscard(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName: string; paths: string[] }) =>
      api.codeGitDiscard(projectId, data.repoName, data.paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.gitStatus(projectId) });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/lib/queries/use-code.ts
git commit -m "feat(web): add code API methods and TanStack Query hooks"
```

---

## Task 6: Frontend — RightPanel 'code' Tab Integration

**Files:**
- Modify: `packages/web/src/components/workspace/right-panel.tsx`

- [ ] **Step 1: Add 'code' to RightTab type and render CodePanel**

Modify `packages/web/src/components/workspace/right-panel.tsx`:

Change `RightTab` type:
```typescript
type RightTab = 'collab' | 'preview' | 'code';
```

Add import at top:
```typescript
import { CodePanel } from '@/components/code';
```

Add third tab button after "预览" button:
```tsx
<button
  onClick={() => setActiveTab('code')}
  className={cn(
    'px-3 py-2 text-[13px] font-semibold transition-colors',
    activeTab === 'code'
      ? 'text-accent-primary border-b-2 border-accent-primary'
      : 'text-text-muted hover:text-text-secondary'
  )}
>
  代码
</button>
```

Add `activeTab === 'code'` case in the content section, after the preview case:
```tsx
{activeTab === 'code' && <CodePanel project={project} />}
```

The `CodePanel` doesn't need `userId` or `onAddElement` — only `project` for the projectId.

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/workspace/right-panel.tsx
git commit -m "feat(web): add 'code' tab to RightPanel"
```

---

## Task 7: Frontend — CodePanel & CodeSidebar (Shell Components)

**Files:**
- Create: `packages/web/src/components/code/index.tsx`
- Create: `packages/web/src/components/code/code-sidebar.tsx`

- [ ] **Step 1: Create CodePanel shell component**

```tsx
// packages/web/src/components/code/index.tsx

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CodeSidebar } from './code-sidebar';
import { CodeEditor } from './code-editor';
import type { Project } from '@/types';

interface CodePanelProps {
  project: Project | null;
}

type SideView = 'files' | 'git' | 'search';

export function CodePanel({ project }: CodePanelProps) {
  const [sideView, setSideView] = useState<SideView>('git');
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [viewingCommit, setViewingCommit] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  return (
    <div className="h-full flex bg-code-bg-base text-code-text-primary">
      <CodeSidebar
        project={project}
        sideView={sideView}
        onSideViewChange={setSideView}
        activeRepo={activeRepo}
        onActiveRepoChange={setActiveRepo}
        viewingCommit={viewingCommit}
        onViewCommit={setViewingCommit}
      />
      <CodeEditor
        project={project}
        activeRepo={activeRepo}
        viewingCommit={viewingCommit}
        onViewingCommitChange={setViewingCommit}
        viewingFile={viewingFile}
        onViewingFileChange={setViewingFile}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create CodeSidebar shell component**

```tsx
// packages/web/src/components/code/code-sidebar.tsx

'use client';

import { cn } from '@/lib/utils';
import { BranchIndicator } from './branch-indicator';
import { CommitInput } from './commit-input';
import { ChangesList } from './changes-list';
import { BranchTree } from './branch-tree';
import { RepoAccordion } from './repo-accordion';
import type { Project } from '@/types';

type SideView = 'files' | 'git' | 'search';

interface CodeSidebarProps {
  project: Project | null;
  sideView: SideView;
  onSideViewChange: (view: SideView) => void;
  activeRepo: string | null;
  onActiveRepoChange: (repo: string) => void;
  viewingCommit: string | null;
  onViewCommit: (hash: string | null) => void;
}

const sideViewOptions: { key: SideView; label: string }[] = [
  { key: 'files', label: 'Files' },
  { key: 'git', label: 'Git' },
  { key: 'search', label: 'Search' },
];

export function CodeSidebar({
  project,
  sideView,
  onSideViewChange,
  activeRepo,
  onActiveRepoChange,
  viewingCommit,
  onViewCommit,
}: CodeSidebarProps) {
  return (
    <div className="flex flex-col w-[var(--code-sidebar-width)] bg-code-bg-surface border-r border-code-border overflow-hidden">
      {/* Side panel tabs */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-code-border bg-code-bg-surface">
        {sideViewOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onSideViewChange(opt.key)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors',
              sideView === opt.key
                ? 'text-code-accent bg-code-bg-base'
                : 'text-code-text-secondary hover:text-code-text-primary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Git view content */}
      {sideView === 'git' && (
        <>
          <BranchIndicator project={project} activeRepo={activeRepo} />
          <CommitInput project={project} activeRepo={activeRepo} />
          <ChangesList project={project} activeRepo={activeRepo} onActiveRepoChange={onActiveRepoChange} />
          <BranchTree
            project={project}
            activeRepo={activeRepo}
            viewingCommit={viewingCommit}
            onViewCommit={onViewCommit}
          />
          <RepoAccordion project={project} activeRepo={activeRepo} onActiveRepoChange={onActiveRepoChange} />
        </>
      )}

      {/* Files view placeholder */}
      {sideView === 'files' && (
        <div className="flex-1 flex items-center justify-center text-code-text-secondary text-xs">
          File browser coming soon
        </div>
      )}

      {/* Search placeholder */}
      {sideView === 'search' && (
        <div className="flex-1 flex items-center justify-center text-code-text-secondary text-xs">
          Code search coming soon
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/code/index.tsx packages/web/src/components/code/code-sidebar.tsx
git commit -m "feat(web): add CodePanel and CodeSidebar shell components"
```

---

## Task 8: Frontend — BranchIndicator & CommitInput Components

**Files:**
- Create: `packages/web/src/components/code/branch-indicator.tsx`
- Create: `packages/web/src/components/code/commit-input.tsx`

- [ ] **Step 1: Create BranchIndicator**

```tsx
// packages/web/src/components/code/branch-indicator.tsx

'use client';

import { useCodeGitStatus, useCodeGitPull, useCodeGitPush } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface BranchIndicatorProps {
  project: Project | null;
  activeRepo: string | null;
}

export function BranchIndicator({ project, activeRepo }: BranchIndicatorProps) {
  const { data: statuses } = useCodeGitStatus(project?.id ?? null);
  const pullMutation = useCodeGitPull(project?.id ?? 0);
  const pushMutation = useCodeGitPush(project?.id ?? 0);

  const currentRepo = statuses?.find((s) => s.repoName === activeRepo) ?? statuses?.[0];

  return (
    <div className="px-3 py-2.5 border-b border-code-border flex items-center gap-2 bg-code-bg-base">
      <div className="w-6 h-6 rounded-md bg-[rgba(0,120,212,0.15)] flex items-center justify-center">
        <svg viewBox="0 0 16 16" fill="#0078d4" className="w-3.5 h-3.5">
          <path d="M9.5 3L4 8.5 9.5 14l1-1L5.5 8.5l5-4.5z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-code-text-primary truncate">{currentRepo?.repoName || '—'}</div>
        <div className="text-[11px] text-code-text-secondary flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-code-git-added" />
          {currentRepo?.branch || '—'}
        </div>
      </div>
      <button
        onClick={() => pullMutation.mutate({ repoName: activeRepo })}
        disabled={pullMutation.isPending}
        className="px-2 py-1 text-[11px] rounded bg-transparent border border-code-border text-code-text-secondary hover:bg-code-bg-hover hover:text-code-text-primary transition-colors disabled:opacity-50"
      >
        Pull
      </button>
      <button
        onClick={() => pushMutation.mutate({ repoName: activeRepo })}
        disabled={pushMutation.isPending}
        className="px-2 py-1 text-[11px] rounded bg-code-accent text-code-text-contrast hover:bg-code-accent-hover transition-colors disabled:opacity-50"
      >
        Push
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create CommitInput**

```tsx
// packages/web/src/components/code/commit-input.tsx

'use client';

import { useState } from 'react';
import { useCodeGitCommit, useCodeGitPush } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface CommitInputProps {
  project: Project | null;
  activeRepo: string | null;
}

export function CommitInput({ project, activeRepo }: CommitInputProps) {
  const [message, setMessage] = useState('');
  const commitMutation = useCodeGitCommit(project?.id ?? 0);
  const pushMutation = useCodeGitPush(project?.id ?? 0);

  const handleCommit = async () => {
    if (!message.trim()) return;
    await commitMutation.mutateAsync({ message: message.trim(), repoName: activeRepo });
    setMessage('');
  };

  const handleCommitAndPush = async () => {
    if (!message.trim()) return;
    await commitMutation.mutateAsync({ message: message.trim(), repoName: activeRepo });
    await pushMutation.mutateAsync({ repoName: activeRepo });
    setMessage('');
  };

  return (
    <div className="px-3 py-2 border-b border-code-border">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message (Ctrl+Enter to commit)"
        rows={1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) handleCommit();
        }}
        className="w-full bg-code-bg-base border border-code-border rounded px-2 py-1.5 text-xs text-code-text-primary placeholder:text-code-text-muted outline-none resize-none transition-colors focus:border-code-accent"
      />
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={handleCommit}
          disabled={!message.trim() || commitMutation.isPending}
          className="flex-1 px-3 py-1.5 text-[11px] font-medium rounded bg-code-accent text-code-text-contrast hover:bg-code-accent-hover transition-colors disabled:opacity-50"
        >
          Commit
        </button>
        <button
          onClick={handleCommitAndPush}
          disabled={!message.trim() || commitMutation.isPending || pushMutation.isPending}
          className="px-3 py-1.5 text-[11px] font-medium rounded bg-code-bg-elevated text-code-text-primary hover:bg-code-bg-hover transition-colors disabled:opacity-50"
        >
          Commit & Push
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/code/branch-indicator.tsx packages/web/src/components/code/commit-input.tsx
git commit -m "feat(web): add BranchIndicator and CommitInput components"
```

---

## Task 9: Frontend — ChangesList & RepoAccordion Components

**Files:**
- Create: `packages/web/src/components/code/changes-list.tsx`
- Create: `packages/web/src/components/code/repo-accordion.tsx`

- [ ] **Step 1: Create ChangesList**

```tsx
// packages/web/src/components/code/changes-list.tsx

'use client';

import { useCodeGitStatus, useCodeGitStage, useCodeGitDiscard } from '@/lib/queries/use-code';
import { cn } from '@/lib/utils';
import { GIT_STATUS_LABELS, GIT_STATUS_COLORS } from '@/types/code';
import type { Project } from '@/types';
import type { GitFileStatus } from '@/types/code';

interface ChangesListProps {
  project: Project | null;
  activeRepo: string | null;
  onActiveRepoChange: (repo: string) => void;
}

export function ChangesList({ project, activeRepo, onActiveRepoChange }: ChangesListProps) {
  const { data: statuses } = useCodeGitStatus(project?.id ?? null);
  const stageMutation = useCodeGitStage(project?.id ?? 0);
  const discardMutation = useCodeGitDiscard(project?.id ?? 0);

  const currentRepo = statuses?.find((s) => s.repoName === activeRepo) ?? statuses?.[0];
  const otherRepos = statuses?.filter((s) => s.repoName !== currentRepo?.repoName) ?? [];

  if (!statuses || statuses.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-code-text-muted text-center">
        No git repos found
      </div>
    );
  }

  return (
    <div>
      {/* Current repo changes */}
      <div className="px-3 py-1.5 text-[11px] font-semibold text-code-text-secondary uppercase tracking-wide flex items-center gap-2">
        Changes <span className="text-code-text-muted font-normal normal-case">{currentRepo?.files.length ?? 0}</span>
      </div>
      {currentRepo?.files.map((file) => (
        <div
          key={file.path}
          className={cn(
            'px-3 pl-5 py-1 text-xs flex items-center justify-between cursor-pointer transition-colors hover:bg-code-bg-hover',
            getStatusTextColor(file.status),
          )}
        >
          <span className="truncate flex-1">{file.path}</span>
          <span
            className={cn(
              'text-[9px] px-1 rounded font-semibold ml-1',
              getStatusBadgeStyle(file.status),
            )}
          >
            {GIT_STATUS_LABELS[file.status]}
          </span>
          <div className="flex gap-0.5 ml-2">
            <button
              onClick={() => stageMutation.mutate({ repoName: currentRepo.repoName, paths: [file.path] })}
              className="w-5 h-5 flex items-center justify-center text-code-text-muted hover:text-code-text-primary hover:bg-code-bg-elevated rounded transition-colors text-xs"
              title="Stage"
            >
              +
            </button>
            {file.status !== 'added' && (
              <button
                onClick={() => discardMutation.mutate({ repoName: currentRepo.repoName, paths: [file.path] })}
                className="w-5 h-5 flex items-center justify-center text-code-text-muted hover:text-code-text-primary hover:bg-code-bg-elevated rounded transition-colors text-xs"
                title="Discard"
              >
                ↩
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Other repos as compact references */}
      {otherRepos.map((repo) => (
        <div
          key={repo.repoName}
          onClick={() => onActiveRepoChange(repo.repoName)}
          className="px-3 py-1 text-[11px] text-code-text-muted hover:text-code-text-secondary cursor-pointer flex items-center gap-1 transition-colors"
        >
          {repo.repoName} · {repo.files.filter(f => f.status === 'modified').length}M {repo.files.filter(f => f.status === 'added').length}A
        </div>
      ))}
    </div>
  );
}

function getStatusTextColor(status: GitFileStatus): string {
  if (status === 'modified' || status === 'deleted') return 'text-code-git-modified';
  if (status === 'added') return 'text-code-git-added';
  if (status === 'untracked') return 'text-code-git-untracked';
  if (status === 'renamed') return 'text-code-git-renamed';
  return '';
}

function getStatusBadgeStyle(status: GitFileStatus): string {
  if (status === 'modified' || status === 'deleted') return 'bg-[rgba(231,76,60,0.15)] text-code-git-modified';
  if (status === 'added') return 'bg-[rgba(34,197,94,0.15)] text-code-git-added';
  if (status === 'untracked') return 'bg-[rgba(0,120,212,0.15)] text-code-git-untracked';
  if (status === 'renamed') return 'bg-[rgba(212,160,23,0.15)] text-code-git-renamed';
  return '';
}
```

- [ ] **Step 2: Create RepoAccordion**

```tsx
// packages/web/src/components/code/repo-accordion.tsx

'use client';

import { useCodeGitStatus } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface RepoAccordionProps {
  project: Project | null;
  activeRepo: string | null;
  onActiveRepoChange: (repo: string) => void;
}

export function RepoAccordion({ project, activeRepo, onActiveRepoChange }: RepoAccordionProps) {
  const { data: statuses } = useCodeGitStatus(project?.id ?? null);

  // Only show repos that are NOT the currently active one
  const otherRepos = statuses?.filter((s) => s.repoName !== activeRepo) ?? [];

  if (otherRepos.length === 0) return null;

  return (
    <div className="border-t border-code-border">
      {otherRepos.map((repo) => (
        <div
          key={repo.repoName}
          onClick={() => onActiveRepoChange(repo.repoName)}
          className="px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors bg-code-bg-surface hover:bg-code-bg-hover"
        >
          <span className="text-code-text-primary font-semibold text-xs">⎇</span>
          <span className="text-xs font-semibold text-code-text-primary">{repo.repoName}</span>
          <span className="text-[11px] text-code-text-secondary">· {repo.branch}</span>
          <span className="text-[10px] text-code-git-modified">{repo.files.filter(f => f.status === 'modified').length}✕</span>
          <span className="text-[10px] text-code-git-added">{repo.files.filter(f => f.status === 'added').length}+</span>
          <span className="text-[11px] text-code-text-muted ml-auto">▶</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/code/changes-list.tsx packages/web/src/components/code/repo-accordion.tsx
git commit -m "feat(web): add ChangesList and RepoAccordion components"
```

---

## Task 10: Frontend — BranchTree Component

**Files:**
- Create: `packages/web/src/components/code/branch-tree.tsx`

- [ ] **Step 1: Create BranchTree with visual branch topology and click-to-view-commit**

```tsx
// packages/web/src/components/code/branch-tree.tsx

'use client';

import { useCodeGitLog } from '@/lib/queries/use-code';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import type { CommitNode } from '@/types/code';
import { REPO_COLORS } from '@/types/code';

interface BranchTreeProps {
  project: Project | null;
  activeRepo: string | null;
  viewingCommit: string | null;
  onViewCommit: (hash: string | null) => void;
}

export function BranchTree({ project, activeRepo, viewingCommit, onViewCommit }: BranchTreeProps) {
  const { data: commits, isLoading } = useCodeGitLog(project?.id ?? null, activeRepo ?? undefined);

  if (isLoading) {
    return (
      <div className="px-3 py-4 text-xs text-code-text-muted text-center">Loading commits...</div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-code-text-muted text-center">No commits found</div>
    );
  }

  // Assign colors to branches
  const branchColorMap = assignBranchColors(commits);

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* Section header */}
      <div className="px-3 py-1.5 text-[11px] font-semibold text-code-text-secondary uppercase tracking-wide border-t border-code-border flex items-center gap-2">
        Commits <span className="text-code-text-muted font-normal normal-case">{commits.length}</span>
      </div>

      {/* Commit nodes */}
      {commits.map((commit) => (
        <CommitNodeItem
          key={commit.hash}
          commit={commit}
          isSelected={viewingCommit === commit.hash}
          branchColor={branchColorMap[commit.branch] ?? '#0078d4'}
          onClick={() => onViewCommit(commit.hash)}
        />
      ))}
    </div>
  );
}

function CommitNodeItem({
  commit,
  isSelected,
  branchColor,
  onClick,
}: {
  commit: CommitNode;
  isSelected: boolean;
  branchColor: string;
  onClick: () => void;
}) {
  const isMerged = commit.branch.includes('merged') || commit.branch.startsWith('↗');
  const dotColor = isMerged ? '#808080' : branchColor;
  const dotOpacity = isMerged ? 'opacity-40' : '';

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center px-2 py-0.5 cursor-pointer transition-colors',
        isSelected ? 'bg-code-bg-active' : 'hover:bg-code-bg-hover',
      )}
    >
      {/* Graph column — dot */}
      <div className="w-8 flex items-center justify-center">
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full border-2',
            dotOpacity,
          )}
          style={{
            borderColor: dotColor,
            backgroundColor: commit.isHead ? dotColor : 'transparent',
          }}
        />
      </div>

      {/* Commit info */}
      <div className="flex-1 flex items-center gap-1.5 text-xs min-w-0">
        {/* Branch tag */}
        {commit.isHead && (
          <span
            className="text-[10px] px-1 py-0.5 rounded font-semibold border"
            style={{
              color: branchColor,
              borderColor: branchColor,
              backgroundColor: `${branchColor}20`,
            }}
          >
            ⎇ {commit.branch.replace('HEAD -> ', '').split(',')[0]}
          </span>
        )}
        {isMerged && (
          <span className="text-[10px] px-1 py-0.5 rounded font-semibold bg-[rgba(128,128,128,0.1)] text-[#808080]">
            {commit.branch}
          </span>
        )}

        {/* Hash */}
        <span className="font-mono text-code-text-primary text-[11px]">{commit.hash.slice(0, 7)}</span>

        {/* Message */}
        {!commit.isHead && !isMerged && (
          <span className="text-code-text-primary truncate text-xs">{commit.message}</span>
        )}

        {/* Time */}
        <span className="text-code-text-muted text-[10px]">{formatTime(commit.timestamp)}</span>
      </div>
    </div>
  );
}

function assignBranchColors(commits: CommitNode[]): Record<string, string> {
  const colors: Record<string, string> = {};
  let colorIndex = 0;
  for (const commit of commits) {
    const branch = commit.branch.replace('HEAD -> ', '').split(',')[0].trim();
    if (!colors[branch] && !branch.startsWith('↗')) {
      colors[branch] = REPO_COLORS[colorIndex % REPO_COLORS.length];
      colorIndex++;
    }
  }
  return colors;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 1) return 'now';
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/code/branch-tree.tsx
git commit -m "feat(web): add BranchTree component with visual topology"
```

---

## Task 11: Frontend — CodeEditor, DiffViewer, FileTabs, StatusBar

**Files:**
- Create: `packages/web/src/components/code/code-editor.tsx`
- Create: `packages/web/src/components/code/commit-view-header.tsx`
- Create: `packages/web/src/components/code/diff-viewer.tsx`
- Create: `packages/web/src/components/code/file-tabs.tsx`

- [ ] **Step 1: Create CodeEditor (orchestrator)**

```tsx
// packages/web/src/components/code/code-editor.tsx

'use client';

import { CommitViewHeader } from './commit-view-header';
import { DiffViewer } from './diff-viewer';
import type { Project } from '@/types';

interface CodeEditorProps {
  project: Project | null;
  activeRepo: string | null;
  viewingCommit: string | null;
  onViewingCommitChange: (hash: string | null) => void;
  viewingFile: string | null;
  onViewingFileChange: (path: string | null) => void;
}

export function CodeEditor({
  project,
  activeRepo,
  viewingCommit,
  onViewingCommitChange,
}: CodeEditorProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Commit view banner — shown when viewing a specific commit */}
      {viewingCommit && (
        <CommitViewHeader
          project={project}
          hash={viewingCommit}
          repoName={activeRepo}
          onClose={() => onViewingCommitChange(null)}
        />
      )}

      {/* Diff viewer */}
      {viewingCommit && (
        <DiffViewer
          project={project}
          hash={viewingCommit}
          repoName={activeRepo}
        />
      )}

      {/* Empty state when no commit selected */}
      {!viewingCommit && (
        <div className="flex-1 flex items-center justify-center text-code-text-muted text-sm">
          Click a commit in the branch tree to view its diff
        </div>
      )}

      {/* Status bar */}
      <div className="h-[var(--code-statusbar-height)] bg-code-statusbar-bg flex items-center justify-between px-3 text-[11px] text-code-text-contrast">
        <div className="flex items-center gap-3">
          <span className="font-semibold">⎇ {activeRepo || '—'}</span>
          <span>· main</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Diff</span>
          <span>TypeScript</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CommitViewHeader**

```tsx
// packages/web/src/components/code/commit-view-header.tsx

'use client';

import { useCodeGitLog } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface CommitViewHeaderProps {
  project: Project | null;
  hash: string;
  repoName: string | null;
  onClose: () => void;
}

export function CommitViewHeader({ project, hash, repoName, onClose }: CommitViewHeaderProps) {
  const { data: commits } = useCodeGitLog(project?.id ?? null, repoName ?? undefined);
  const commit = commits?.find((c) => c.hash === hash || c.hash.startsWith(hash));

  return (
    <div className="px-4 py-1.5 bg-code-bg-active border-b border-code-accent flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-code-accent font-semibold">Viewing commit</span>
        <span className="text-code-text-contrast font-semibold font-mono">{hash.slice(0, 7)}</span>
        {commit && <span className="text-code-text-primary">{commit.message}</span>}
        {commit && <span className="text-code-text-muted">· {commit.author}</span>}
      </div>
      <button
        onClick={onClose}
        className="px-2 py-0.5 text-[11px] rounded border border-code-border text-code-text-muted hover:text-code-text-primary hover:bg-code-bg-elevated transition-colors"
      >
        Close
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create DiffViewer**

```tsx
// packages/web/src/components/code/diff-viewer.tsx

'use client';

import { useCodeCommitDiff } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface DiffViewerProps {
  project: Project | null;
  hash: string;
  repoName: string | null;
}

export function DiffViewer({ project, hash, repoName }: DiffViewerProps) {
  const { data, isLoading } = useCodeCommitDiff(project?.id ?? null, hash, repoName ?? undefined);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-code-text-muted text-xs">Loading diff...</div>;
  }

  if (!data?.diff) {
    return <div className="flex-1 flex items-center justify-center text-code-text-muted text-xs">No diff available</div>;
  }

  const lines = data.diff.split('\n');

  return (
    <div className="flex-1 overflow-y-auto font-mono text-[13px] leading-[20px]">
      {lines.map((line, i) => {
        if (line.startsWith('diff --git')) {
          return <DiffFileHeader key={i} line={line} />;
        }
        if (line.startsWith('---') || line.startsWith('+++')) {
          return null; // skip ---/+++ lines, info shown in file header
        }
        if (line.startsWith('-') && !line.startsWith('--')) {
          return (
            <div key={i} className="bg-code-diff-deleted-bg px-4 text-code-git-modified">
              <span className="inline-block w-4 text-right mr-2 select-none">{line[0]}</span>
              <span>{line.slice(1)}</span>
            </div>
          );
        }
        if (line.startsWith('+') && !line.startsWith('++')) {
          return (
            <div key={i} className="bg-code-diff-added-bg px-4 text-code-git-added">
              <span className="inline-block w-4 text-right mr-2 select-none">{line[0]}</span>
              <span>{line.slice(1)}</span>
            </div>
          );
        }
        if (line.startsWith('@')) {
          return (
            <div key={i} className="px-4 text-code-accent bg-code-bg-elevated text-[11px]">
              {line}
            </div>
          );
        }
        // Context line
        return (
          <div key={i} className="px-4 pl-8 text-code-text-primary">
            {line}
          </div>
        );
      })}
    </div>
  );
}

function DiffFileHeader({ line }: { line: string }) {
  // Parse "diff --git a/path b/path"
  const match = line.match(/diff --git a\/(.+) b\/(.+)/);
  const fileName = match?.[2] || line;
  return (
    <div className="px-4 py-1.5 bg-code-bg-elevated text-code-text-primary text-[12px] flex items-center gap-2 cursor-pointer hover:bg-code-bg-hover">
      <svg viewBox="0 0 16 16" fill="#cccccc" className="w-3.5 h-3.5">
        <path d="M13.5 3H8V1.5l-1-1H2.5l-1 1V5h-1v2h1v7.5l1 1h9l1-1V5h1V3h-1z"/>
      </svg>
      {fileName}
    </div>
  );
}
```

- [ ] **Step 4: Create FileTabs (placeholder for file browsing, initially unused)**

```tsx
// packages/web/src/components/code/file-tabs.tsx

'use client';

import { cn } from '@/lib/utils';

interface FileTab {
  path: string;
  repoName: string;
  active: boolean;
}

interface FileTabsProps {
  tabs: FileTab[];
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function FileTabs({ tabs, onTabClick, onTabClose }: FileTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex bg-code-bg-surface border-b border-code-border h-[35px] overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          onClick={() => onTabClick(tab.path)}
          className={cn(
            'flex items-center gap-1.5 px-3 text-xs cursor-pointer border-r border-code-border transition-colors h-full relative',
            tab.active ? 'text-code-text-contrast bg-code-bg-base' : 'text-code-text-secondary hover:text-code-text-primary',
          )}
        >
          {tab.active && (
            <div className="absolute top-0 left-0 right-0 h-px bg-code-accent" />
          )}
          <span className="truncate max-w-[120px]">{tab.path.split('/').pop()}</span>
          <span className="text-[9px] px-1 rounded font-semibold bg-[rgba(0,120,212,0.2)] text-code-accent">
            {tab.repoName.slice(0, 2).toUpperCase()}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onTabClose(tab.path); }}
            className="w-4 h-4 flex items-center justify-center text-code-text-muted hover:text-code-text-primary hover:bg-code-bg-elevated rounded text-[10px] transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/code/code-editor.tsx packages/web/src/components/code/commit-view-header.tsx packages/web/src/components/code/diff-viewer.tsx packages/web/src/components/code/file-tabs.tsx
git commit -m "feat(web): add CodeEditor, CommitViewHeader, DiffViewer, and FileTabs"
```

---

## Task 12: Frontend — Verify & Integration Test

**Files:**
- No new files — verification of full integration

- [ ] **Step 1: Verify frontend builds without errors**

Run: `cd packages/web && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 2: Verify server builds without errors**

Run: `cd packages/server && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Start dev servers and test manually**

Run: `npm run dev` (both server and web)
Expected: App loads, clicking "代码" tab shows the CodePanel with VSCode dark theme

- [ ] **Step 4: Test git operations end-to-end**

1. Select a project with a running container
2. Click "代码" tab — should show BranchIndicator, ChangesList, BranchTree
3. Click a commit in BranchTree — should show diff in editor area
4. Write a commit message, click Commit — should commit changes
5. Click Push — should push to remote

- [ ] **Step 5: Final commit if any fixes needed**

---

## Self-Review

**1. Spec coverage:** Each spec section maps to tasks:
- Right panel extension → Task 6
- Branch indicator → Task 8
- Commit input → Task 8
- Changes list → Task 9
- Branch tree → Task 10
- Diff viewer → Task 11
- Status bar → Task 11 (inside CodeEditor)
- Repo accordion → Task 9
- Color tokens → Task 4
- Server API → Tasks 1-3
- File tabs → Task 11 (placeholder for future file browsing)
- Files/Search sidebar tabs → Task 7 (placeholder)

**2. Placeholder scan:** No TBD/TODO found. All steps have complete code. Files and Search tabs show "coming soon" placeholder text — this is per spec (YAGNI section says Search tab is placeholder only).

**3. Type consistency:** Types defined in Task 1 (server) and Task 4 (frontend) match: `RepoGitStatus`, `CommitNode`, `GitFileChange`, `GitFileStatus`, `BranchInfo`, `FileContent`, `FileTreeNode`. All components reference the same types from `@/types/code`. API methods in Task 5 return the same types. Query hooks in Task 5 use the same API methods.