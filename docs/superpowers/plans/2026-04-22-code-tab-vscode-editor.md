# Code Tab — code-server Embedded Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "代码" tab to the right panel that embeds code-server (web VS Code) inside the project's Docker container, providing full file editing, git operations, terminal, and extensions via an iframe.

**Architecture:** Server starts/stops code-server inside Docker containers and proxies HTTP traffic through Express (auth-protected reverse proxy at `/api/projects/:projectId/code-server/*`). Frontend CodePanel renders an iframe pointing to the proxy route, with a toolbar overlay for connection status and manual start/stop control. The existing `CodeService` git/file API endpoints are removed — code-server handles all of that natively.

**Tech Stack:** Express.js + `http-proxy` (server proxy), Dockerode + `CodeServerManager` (container lifecycle), React + TanStack Query (frontend state), iframe embedding (editor)

---

## Task 1: Server — Wire CodeServerManager into Code Module

**Files:**
- Move: `packages/server/src/modules/container/lib/code-server-manager.ts` → `packages/server/src/modules/code/lib/code-server-manager.ts`
- Modify: `packages/server/src/modules/code/code.module.ts`
- Modify: `packages/server/src/modules/code/service.ts`

The `CodeServerManager` already exists as an untracked file at `container/lib/`. It needs to be moved into the `code` module and registered in DI. The `CodeService` will delegate code-server lifecycle calls to `CodeServerManager`.

- [ ] **Step 1: Move code-server-manager.ts into code module**

Move the file from `packages/server/src/modules/container/lib/code-server-manager.ts` to `packages/server/src/modules/code/lib/code-server-manager.ts`.

Update imports in the moved file — change `DockerService` import path:
```typescript
import { DockerService } from '../container/lib/docker.service.js';
```
(stays the same since relative path from `code/lib/` to `container/lib/` is `../container/lib/`)

- [ ] **Step 2: Update code.module.ts to register CodeServerManager**

`packages/server/src/modules/code/code.module.ts`:
```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';
import { CodeService } from './service.js';
import { CodeController } from './controller.js';
import { CodeServerManager } from './lib/code-server-manager.js';
import { DockerService } from '../container/lib/docker.service.js';
import { ProjectRepository } from '../project/repository.js';
import { PermissionService } from '../../shared/permission.service.js';

export function registerCodeModule(): void {
  container.registerSingleton(CodeServerManager);
  container.registerSingleton(CodeService);
  container.registerSingleton(CodeController);
}

export { CodeService, CodeController, CodeServerManager };
export { createCodeRoutes } from './routes.js';
```

- [ ] **Step 3: Add code-server lifecycle methods to CodeService**

Add methods to `packages/server/src/modules/code/service.ts`:

```typescript
import { CodeServerManager } from './lib/code-server-manager.js';

@singleton()
export class CodeService {
  constructor(
    @inject(DockerService) private readonly docker: DockerService,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(PermissionService) private readonly permission: PermissionService,
    @inject(CodeServerManager) private readonly codeServerManager: CodeServerManager,
  ) {}

  async startCodeServer(userId: number, projectId: number): Promise<{ url: string }> {
    const project = await this.permission.checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    const port = await this.codeServerManager.startCodeServer(projectId, project.containerId);
    const url = this.codeServerManager.getCodeServerUrl(projectId)!;
    return { url };
  }

  async stopCodeServer(userId: number, projectId: number): Promise<{ success: boolean }> {
    const project = await this.permission.checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    await this.codeServerManager.stopCodeServer(projectId, project.containerId);
    return { success: true };
  }

  async getCodeServerStatus(userId: number, projectId: number): Promise<{ running: boolean; url: string | null }> {
    await this.permission.checkProjectAccess(userId, projectId);
    const running = this.codeServerManager.isRunning(projectId);
    const url = this.codeServerManager.getCodeServerUrl(projectId);
    return { running, url };
  }
}
```

Remove all the existing git/file operation methods (`getFileTree`, `getFileContent`, `getGitStatus`, `getGitLog`, `getBranches`, `getCommitDiff`, `commit`, `push`, `pull`, `stage`, `discard`) and all their private parsing helpers from `CodeService`. Code-server handles these natively.

- [ ] **Step 4: Verify server builds**

Run: `cd packages/server && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/modules/code/lib/code-server-manager.ts packages/server/src/modules/code/code.module.ts packages/server/src/modules/code/service.ts
git rm packages/server/src/modules/container/lib/code-server-manager.ts
git commit -m "refactor(server): move CodeServerManager into code module, simplify CodeService"
```

---

## Task 2: Server — Install http-proxy and Add Reverse Proxy Route

**Files:**
- Modify: `packages/server/package.json` (add `http-proxy` dependency)
- Create: `packages/server/src/modules/code/proxy.ts`
- Modify: `packages/server/src/modules/code/routes.ts`

The Express server needs to reverse-proxy requests to code-server running inside the Docker container. This avoids exposing container ports directly and keeps everything behind authentication.

- [ ] **Step 1: Install http-proxy**

Run: `cd packages/server && npm install http-proxy`

- [ ] **Step 2: Create proxy.ts**

`packages/server/src/modules/code/proxy.ts`:

```typescript
import httpProxy from 'http-proxy';
import { CodeServerManager } from './lib/code-server-manager.js';
import { createLogger } from '../../../core/logger/index.js';

const logger = createLogger('code-server-proxy');

const proxy = httpProxy.createProxyServer({
  ws: true, // WebSocket support for code-server terminal/extensions
});

proxy.on('error', (err, _req, _res) => {
  logger.error('Proxy error', err instanceof Error ? err : new Error(String(err)));
});

export function createCodeServerProxy(codeServerManager: CodeServerManager) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const projectId = Number(req.params.projectId);
    const info = codeServerManager.getCodeServerInfo(projectId);

    if (!info || !info.running) {
      res.status(503).json({ error: 'code-server is not running for this project' });
      return;
    }

    // Build the target URL: container's internal IP + port 8080
    const target = `http://${info.containerIp}:8080`;

    // Rewrite path: strip /api/projects/:projectId/code-server prefix
    const originalPath = req.url;
    const prefix = `/api/projects/${projectId}/code-server`;
    req.url = originalPath.replace(prefix, '') || '/';

    proxy.web(req, res, { target }, next);
  };
}

export function handleCodeServerWebSocketUpgrade(
  codeServerManager: CodeServerManager,
  server: import('http').Server
) {
  server.on('upgrade', (req, socket, head) => {
    const match = req.url?.match(/^\/api\/projects\/(\d+)\/code-server/);
    if (!match) return;

    const projectId = Number(match[1]);
    const info = codeServerManager.getCodeServerInfo(projectId);

    if (!info || !info.running) {
      socket.destroy();
      return;
    }

    const target = `http://${info.containerIp}:8080`;
    const prefix = `/api/projects/${projectId}/code-server`;
    req.url = req.url!.replace(prefix, '') || '/';

    proxy.ws(req, socket, head, { target }, (err) => {
      logger.error('WS proxy error', err instanceof Error ? err : new Error(String(err)));
      socket.destroy();
    });
  });
}
```

- [ ] **Step 3: Add containerIp tracking to CodeServerManager**

Modify `packages/server/src/modules/code/lib/code-server-manager.ts`:

Change `CodeServerInfo` interface to include `containerIp`:
```typescript
interface CodeServerInfo {
  port: number;
  running: boolean;
  containerIp: string;
}
```

In `startCodeServer`, after starting code-server, resolve the container's IP address and store it:
```typescript
async startCodeServer(projectId: number, containerId: string): Promise<number> {
  const portManager = getPortManager();
  const existing = this.codeServerInfo.get(projectId);
  if (existing && existing.running) {
    return existing.port;
  }

  const port = existing?.port ?? portManager.allocatePort();

  try {
    const result = await this.docker.execInContainer(containerId, [
      'sh', '-c',
      'nohup code-server --auth none --bind-addr 0.0.0.0:8080 --disable-telemetry --disable-update-check /workspace > /home/codelink/code-server.log 2>&1 & echo "code-server started"',
    ]);

    if (result.exitCode !== 0 && result.stderr) {
      logger.warn('code-server start may have issues', { stderr: result.stderr });
    }

    await this.waitForReady(containerId);

    // Resolve container IP from Docker network
    const containerIp = await this.getContainerIp(containerId);

    this.codeServerInfo.set(projectId, { port, running: true, containerIp });
    logger.info('code-server started', { projectId, port, containerIp });
    return port;
  } catch (error) {
    if (!existing) {
      portManager.releasePort(port);
    }
    logger.error('Failed to start code-server', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

private async getContainerIp(containerId: string): Promise<string> {
  const container = this.docker.getClient().getContainer(containerId);
  const info = await container.inspect();
  // Use the first network IP (usually bridge network)
  const networks = info.NetworkSettings.Networks;
  const networkName = Object.keys(networks)[0];
  return networks[networkName].IPAddress;
}
```

Add `getClient()` method to DockerService (or use dockerode directly). The simplest approach: `CodeServerManager` uses `DockerService`'s dockerode client. Add a public accessor:

In `packages/server/src/modules/container/lib/docker.service.ts`, add:
```typescript
getClient(): Docker {
  return this.client;
}
```

Also add `getCodeServerInfo` public method to `CodeServerManager`:
```typescript
getCodeServerInfo(projectId: number): CodeServerInfo | null {
  return this.codeServerInfo.get(projectId) ?? null;
}
```

- [ ] **Step 4: Rewrite routes.ts — remove git/file routes, add code-server routes**

`packages/server/src/modules/code/routes.ts`:

```typescript
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateParams } from '../../middleware/validation.js';
import { projectIdParamsSchema } from './schemas.js';
import { CodeController } from './controller.js';
import { CodeServerManager } from './lib/code-server-manager.js';
import { createCodeServerProxy } from './proxy.js';
import { asyncHandler } from '../../core/errors/index.js';

export function createCodeRoutes(controller: CodeController): Router {
  const router = Router();

  // Code-server lifecycle
  router.post(
    '/:projectId/code-server/start',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.startCodeServer(req, res)),
  );
  router.post(
    '/:projectId/code-server/stop',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.stopCodeServer(req, res)),
  );
  router.get(
    '/:projectId/code-server/status',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.getCodeServerStatus(req, res)),
  );

  // Reverse proxy to code-server inside container (all HTTP + WebSocket)
  router.use(
    '/:projectId/code-server',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    createCodeServerProxy(container.resolve(CodeServerManager)),
  );

  return router;
}
```

Note: We need to import `container` from `tsyringe` to resolve `CodeServerManager` for the proxy middleware. Since routes are created in `index.ts` after module registration, the container already has `CodeServerManager`.

Remove all the git/file routes that were previously defined (tree, file, git/status, git/log, git/branches, git/diff, git/commit, git/push, git/pull, git/stage, git/discard).

- [ ] **Step 5: Simplify schemas.ts**

Remove `filePathQuerySchema`, `commitHashQuerySchema`, `commitBodySchema`, `stageBodySchema`, `discardBodySchema`, `pushBodySchema`, `pullBodySchema` from `packages/server/src/modules/code/schemas.ts`. Keep only `projectIdParamsSchema`.

```typescript
import { z } from 'zod/v4';

export const projectIdParamsSchema = z.object({
  projectId: z.string().transform(Number),
});
```

- [ ] **Step 6: Update controller.ts — remove git/file methods, add code-server lifecycle**

`packages/server/src/modules/code/controller.ts`:

```typescript
import { singleton, inject } from 'tsyringe';
import type { Request, Response } from 'express';
import { CodeService } from './service.js';
import { success } from '../../core/errors/index.js';

@singleton()
export class CodeController {
  constructor(@inject(CodeService) private readonly service: CodeService) {}

  async startCodeServer(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.startCodeServer(req.userId!, projectId);
    res.json(success(result));
  }

  async stopCodeServer(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.stopCodeServer(req.userId!, projectId);
    res.json(success(result));
  }

  async getCodeServerStatus(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.getCodeServerStatus(req.userId!, projectId);
    res.json(success(result));
  }
}
```

- [ ] **Step 7: Mount WebSocket upgrade handler in index.ts**

In `packages/server/src/index.ts`, after `createSocketServer(server)`:

```typescript
import { handleCodeServerWebSocketUpgrade } from './modules/code/proxy.js';
import { CodeServerManager } from './modules/code/code.module.js';

// After server creation:
const codeServerManager = container.resolve(CodeServerManager);
handleCodeServerWebSocketUpgrade(codeServerManager, server);
```

This intercepts WebSocket upgrade requests matching `/api/projects/:projectId/code-server` and proxies them to the container's code-server.

- [ ] **Step 8: Verify server builds**

Run: `cd packages/server && npm run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add packages/server/package.json packages/server/package-lock.json packages/server/src/modules/code/proxy.ts packages/server/src/modules/code/routes.ts packages/server/src/modules/code/schemas.ts packages/server/src/modules/code/controller.ts packages/server/src/modules/code/service.ts packages/server/src/modules/code/lib/code-server-manager.ts packages/server/src/modules/container/lib/docker.service.ts packages/server/src/index.ts
git commit -m "feat(server): add code-server reverse proxy and lifecycle routes"
```

---

## Task 3: Frontend — Simplify Code Types & API Methods

**Files:**
- Modify: `packages/web/src/types/code.ts`
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/lib/queries/use-code.ts`
- Modify: `packages/web/src/types/index.ts`

Remove all the git/file types and API methods. Replace with code-server lifecycle types and hooks.

- [ ] **Step 1: Rewrite types/code.ts**

`packages/web/src/types/code.ts`:

```typescript
export interface CodeServerStatus {
  running: boolean;
  url: string | null;
}
```

Remove all previous types: `RepoGitStatus`, `GitFileChange`, `GitFileStatus`, `CommitNode`, `BranchInfo`, `FileContent`, `FileTreeNode`. Remove constants: `GIT_STATUS_COLORS`, `GIT_STATUS_LABELS`, `REPO_COLORS`. Code-server provides all of this natively.

- [ ] **Step 2: Replace code API methods in api.ts**

Remove all 11 git/file methods (`getCodeFileTree` through `codeGitDiscard`). Add 3 new methods:

```typescript
// ─── Code-server lifecycle ─────────────────────────────────
startCodeServer(projectId: number): Promise<{ url: string }> {
  return apiClientMethods.post(`/projects/${projectId}/code-server/start`, {});
},

stopCodeServer(projectId: number): Promise<{ success: boolean }> {
  return apiClientMethods.post(`/projects/${projectId}/code-server/stop`, {});
},

getCodeServerStatus(projectId: number): Promise<CodeServerStatus> {
  return apiClientMethods.get(`/projects/${projectId}/code-server/status`);
},
```

- [ ] **Step 3: Rewrite use-code.ts TanStack Query hooks**

`packages/web/src/lib/queries/use-code.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import type { CodeServerStatus } from '@/types/code.js';

const codeKeys = {
  all: ['code'] as const,
  serverStatus: (projectId: number) => ['code', 'serverStatus', projectId] as const,
};

export function useCodeServerStatus(projectId: number | null) {
  return useQuery<CodeServerStatus>({
    queryKey: codeKeys.serverStatus(projectId!),
    queryFn: () => api.getCodeServerStatus(projectId!),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

export function useStartCodeServer(projectId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.startCodeServer(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}

export function useStopCodeServer(projectId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.stopCodeServer(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}
```

- [ ] **Step 4: Verify frontend types index**

`packages/web/src/types/index.ts` should still have `export * from './code.js';` — no changes needed.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/types/code.ts packages/web/src/lib/api.ts packages/web/src/lib/queries/use-code.ts
git commit -m "refactor(web): simplify code types and API — code-server lifecycle only"
```

---

## Task 4: Frontend — CodePanel iframe Component

**Files:**
- Create: `packages/web/src/components/code/index.tsx`
- Modify: `packages/web/src/components/workspace/right-panel.tsx` (minor import fix if needed)

The CodePanel embeds code-server via an iframe with a toolbar overlay for start/stop/status.

- [ ] **Step 1: Create CodePanel component**

`packages/web/src/components/code/index.tsx`:

```typescript
'use client';

import { useCallback } from 'react';
import { Power, PowerOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCodeServerStatus, useStartCodeServer, useStopCodeServer } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface CodePanelProps {
  project: Project | null;
  userId: number;
}

export function CodePanel({ project, userId }: CodePanelProps) {
  const projectId = project?.id ?? null;

  const statusQuery = useCodeServerStatus(projectId);
  const startMutation = useStartCodeServer(projectId);
  const stopMutation = useStopCodeServer(projectId);

  const handleStart = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  const handleStop = useCallback(() => {
    stopMutation.mutate();
  }, [stopMutation]);

  const isStarting = startMutation.isPending;
  const isRunning = statusQuery.data?.running ?? false;
  const url = statusQuery.data?.url ?? null;

  return (
    <div className="h-full flex flex-col bg-code-bg-base">
      {/* Toolbar overlay */}
      <div className="h-[32px] flex items-center gap-2 px-2 bg-code-bg-surface border-b border-code-border shrink-0">
        <span className="text-[11px] text-code-text-secondary font-mono">
          {project?.name ?? '未选择项目'}
        </span>

        {isRunning ? (
          <button
            onClick={handleStop}
            disabled={stopMutation.isPending}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] rounded text-code-text-primary bg-code-bg-hover hover:bg-code-bg-active transition-colors"
          >
            <PowerOff className="w-3 h-3" />
            {stopMutation.isPending ? '停止中...' : '停止'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] rounded text-white bg-code-accent hover:bg-code-accent-hover transition-colors disabled:opacity-50"
          >
            {isStarting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
            {isStarting ? '启动中...' : '启动'}
          </button>
        )}
      </div>

      {/* iframe or placeholder */}
      {isRunning && url ? (
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title="code-server"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-code-text-muted text-[13px]">
          {isStarting ? '正在启动 code-server...' : '点击「启动」以打开 VS Code 编辑器'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify right-panel.tsx import matches**

The existing `right-panel.tsx` imports `CodePanel` from `@/components/code` — this matches the new file location. No changes needed.

- [ ] **Step 3: Verify frontend builds**

Run: `cd packages/web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/code/index.tsx
git commit -m "feat(web): add CodePanel with code-server iframe and lifecycle controls"
```

---

## Task 5: Frontend — Remove Unused CSS Tokens & Cleanup

**Files:**
- Modify: `packages/web/src/styles/code-tokens.css` (simplify)
- Modify: `packages/web/src/styles/globals.css` (if needed)

The original plan had extensive VSCode-style CSS tokens for a custom UI (sidebar, branch tree, diff viewer, etc.). Since we now use code-server iframe, we only need a minimal set of tokens for the toolbar overlay.

- [ ] **Step 1: Simplify code-tokens.css**

`packages/web/src/styles/code-tokens.css` — replace full content with minimal tokens needed for the toolbar overlay:

```css
:root {
  /* ─── Code tab · Toolbar overlay ──────────────────────────────── */
  --code-bg-base:       #1e1e1e;
  --code-bg-surface:    #181818;
  --code-bg-hover:       #2a2a2a;
  --code-bg-active:      #094771;
  --code-accent:         #0078d4;
  --code-accent-hover:    #1a8ad4;
  --code-border:         #3c3c3c;
  --code-text-primary:   #cccccc;
  --code-text-secondary: #808080;
  --code-text-muted:     #4f4f4f;
}
```

Remove all git-status colors, repo-tag colors, diff backgrounds, layout size tokens — code-server has its own complete theme.

- [ ] **Step 2: Verify globals.css @theme mappings match**

Check that the `@theme inline` block in `globals.css` still has the right mappings for the simplified tokens. Remove any `--color-code-*` mappings that reference deleted tokens.

- [ ] **Step 3: Verify frontend builds**

Run: `cd packages/web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/styles/code-tokens.css packages/web/src/styles/globals.css
git commit -m "refactor(web): simplify code-tokens.css — only toolbar overlay tokens"
```

---

## Task 6: Server — Cleanup Unused Code Module Types

**Files:**
- Modify: `packages/server/src/modules/code/types.ts` (simplify)

The original `types.ts` had git/file domain types. Since we use code-server, we only need `GitExecResult` (used internally by CodeService if it still needs exec helpers) or we can remove it entirely if CodeService no longer runs git commands.

- [ ] **Step 1: Simplify types.ts**

Since `CodeService` now only delegates to `CodeServerManager` and doesn't run git/file commands, remove all types except what's needed for the new API responses:

`packages/server/src/modules/code/types.ts`:

```typescript
export interface CodeServerStartResult {
  url: string;
}

export interface CodeServerStopResult {
  success: boolean;
}

export interface CodeServerStatusResult {
  running: boolean;
  url: string | null;
}
```

Remove `RepoGitStatus`, `GitFileChange`, `GitFileStatus`, `CommitNode`, `BranchInfo`, `FileContent`, `FileTreeNode`, `GitExecResult`.

- [ ] **Step 2: Verify server builds**

Run: `cd packages/server && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/code/types.ts
git commit -m "refactor(server): simplify code module types — code-server lifecycle only"
```

---

## Task 7: Docker Templates — Commit code-server Installation

**Files:**
- Modify: `packages/server/docker/templates/node/Dockerfile`
- Modify: `packages/server/docker/templates/node+java/Dockerfile`
- Modify: `packages/server/docker/templates/node+python/Dockerfile`

These Dockerfiles already have the uncommitted code-server installation block. Just stage and commit.

- [ ] **Step 1: Verify Dockerfile changes are correct**

The existing uncommitted changes add this block to each Dockerfile:
```dockerfile
# 安装 code-server（Web 版 VS Code）
RUN curl -fsSL https://code-server.dev/install.sh | sh && \
    mkdir -p /home/codelink/.config/code-server && \
    chown -R codelink:codelink /home/codelink/.config/code-server && \
    mkdir -p /home/codelink/.local/share/code-server && \
    chown -R codelink:codelink /home/codelink/.local/share/code-server
```

This is correct. No changes needed.

- [ ] **Step 2: Commit**

```bash
git add packages/server/docker/templates/node/Dockerfile packages/server/docker/templates/node+java/Dockerfile packages/server/docker/templates/node+python/Dockerfile
git commit -m "feat(docker): install code-server in all template Dockerfiles"
```

---

## Task 8: Integration Test — Verify Full Flow

**Files:**
- No new files, just verification

- [ ] **Step 1: Verify server builds and starts**

Run: `cd packages/server && npm run build`
Expected: Build succeeds

- [ ] **Step 2: Verify frontend builds**

Run: `cd packages/web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test**

1. Start the server
2. Create a project and start a container
3. Switch to the "代码" tab in the right panel
4. Click "启动" button — code-server should start inside the container
5. The iframe should load code-server UI
6. Click "停止" button — code-server should stop

---

## Self-Review Checklist

1. **Spec coverage:**
   - Right panel tab extension → Task 4 (CodePanel in iframe)
   - File browsing → code-server handles natively
   - Git status/branch/commit/diff → code-server handles natively
   - Multi-repo handling → code-server handles natively (workspace folders)
   - Dark theme → code-server has its own VSCode dark theme
   - Server API endpoints → Task 2 (start/stop/status + reverse proxy)
   - Docker templates → Task 7 (code-server pre-installed)

2. **Placeholder scan:** No TBDs, TODOs, or "implement later" patterns.

3. **Type consistency:**
   - Server: `CodeServerStartResult`, `CodeServerStopResult`, `CodeServerStatusResult` defined in Task 6
   - Frontend: `CodeServerStatus` defined in Task 3
   - API methods: `startCodeServer` returns `{ url: string }`, `stopCodeServer` returns `{ success: boolean }`, `getCodeServerStatus` returns `CodeServerStatus`
   - Controller extracts `projectId` from `req.params` and `userId` from `req.userId!`

---

Plan complete and saved to `docs/superpowers/plans/2026-04-22-code-tab-vscode-editor.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?