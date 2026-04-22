# Server Architecture Review & Improvement Design

**Date**: 2026-04-22
**Scope**: packages/server/ architecture — maintainability & performance
**Approach**: 4-phase incremental improvement
**Priority**: Architecture maintainability first, then runtime reliability

---

## Problem Summary

The server codebase has 13 identified architectural issues. This design addresses the top 8 that impact long-term maintainability and runtime reliability. Minor issues (hardcoded Chinese messages, test env inconsistency) are deferred.

### Critical Issues

| # | Issue | Severity | Phase |
|---|-------|----------|-------|
| 1 | Schema drift — dual definition (raw SQL + Drizzle) | High | 1 |
| 2 | Global mutable state bypasses DI | High | 2 |
| 3 | Docker tight coupling — `new Docker()` in constructor | Medium | 2 |
| 4 | OrganizationService duplicates super-admin checks | Medium | 2 |
| 5 | Middleware resolves DI at request time | Medium | 2 |
| 6 | Cross-module Repository access bypasses boundaries | High | 3 |
| 7 | Fire-and-forget build with no failure notification | Medium | 4 |
| 8 | Request-id middleware never wired in | Low | 4 |
| 9 | No pagination in list endpoints | Medium | 4 |
| 10 | No structured request-context logging | Medium | 4 |

### Deferred Issues

- Hardcoded Chinese error messages (acceptable for current market)
- `NODE_ENV` vs `getConfig().nodeEnv` inconsistency (low impact)
- Unused `IAIService` / `IGitProvider` interfaces (cleaned in Phase 2)

---

## Phase 1: Schema Unification

**Goal**: Eliminate dual schema definition, fully adopt Drizzle Kit migrations.

**Current state**: `initSchema()` in `src/db/init.ts` writes 168 lines of hand-crafted `CREATE TABLE` SQL. `src/db/schema/*.ts` defines the same tables in Drizzle DSL. `migration.ts` does ad-hoc `ALTER TABLE` without version tracking. The two definitions can drift silently.

### Changes

1. **Delete hand-written SQL** — Remove `src/db/init.ts`, `src/db/migration.ts`, `src/migrate.ts`
2. **Configure Drizzle Kit** — Add `drizzle.config.ts` at project root
3. **Generate migrations** — Use `drizzle-kit generate` to produce SQL files into `src/db/migrations/`
4. **Auto-run migrations at startup** — `startServer()` and `startServerForE2E()` call `runMigrations(db)` which executes migration files in order
5. **Simplify `DatabaseConnection`** — Remove `initSchema()` call from `fromSqlite()`, add `runMigrations()` step
6. **Migration journal** — Drizzle Kit automatically creates a `_migrations_journal` table to track applied migrations

### File Changes

- **Delete**: `src/db/init.ts`, `src/db/migration.ts`, `src/migrate.ts`
- **New**: `drizzle.config.ts`, `src/db/migrations/0000_initial.sql` (generated)
- **Modify**: `src/db/connection.ts` — remove initSchema call, add migration runner
- **Modify**: `src/index.ts` — adapt `startServer()` and `startServerForE2E()` flow

### Risk

- One-time migration from hand-written SQL to Drizzle-generated. Must verify generated SQL matches existing table structure.
- E2E tests using in-memory DB must run migrations instead of `initSchema()`.

---

## Phase 2: DI Convergence

**Goal**: Eliminate all module-level mutable singletons, enforce DI container as the sole dependency management mechanism.

**Current state**: 5 modules use `let X: T | null = null` pattern outside DI container. `DockerService` hard-codes `new Docker()`. `OrganizationService` copy-pastes super-admin logic. Middleware uses `container.resolve()` per-request.

### Changes

#### 2.1 EncryptionService — replace `crypto/aes.ts` global state

Create `EncryptionService` singleton that reads key from `getConfig()` in constructor and caches it. Methods: `encrypt(plaintext)` and `decrypt(ciphertext)`.

#### 2.2 SocketServerService — replace `socket/index.ts` global state

Create `SocketServerService` singleton that holds the `Server` instance. `createSocketServer()` registers this as a DI instance. Namespace handlers inject `SocketServerService` instead of importing `getIO()`.

#### 2.3 PortManager — register as DI singleton

Register `PortManager` via `container.registerSingleton(PortManager)` in build module's `registerBuildModule()`. Remove module-level `let portManagerInstance`.

#### 2.4 AIClientFactory — replace `draft/lib/client.ts` global state

Create `AIClientFactory` singleton that initializes Anthropic client from config. Inject into `DraftService` and terminal namespace. Remove `initAIClient()` / `sendAIMessage()` module-level functions.

#### 2.5 DockerService decoupling

Create `IDockerService` interface (reusing existing file). `DockerService` receives `DockerodeOptions` config via constructor injection and creates `new Docker(options)` internally. In tests, mock `IDockerService` can be registered. This does not inject a `Docker` instance itself — Dockerode is not a DI-registered class.

#### 2.6 OrganizationService → PermissionService

Replace 6x copy-pasted super-admin check with `this.permissionService.isSuperAdmin(userId)` call. Remove direct `AuthRepository` dependency from `OrganizationService`.

#### 2.7 AuthMiddlewareService — formalize middleware DI

Create `AuthMiddlewareService` singleton injecting `AuthRepository`, `OrganizationRepository`, `ProjectRepository`. Middleware factory functions call service methods instead of `container.resolve()`.

#### 2.8 Dead code cleanup

- Delete `core/interfaces/IAIService` (never implemented)
- Delete `core/interfaces/IGitProvider` (never implemented)
- Delete `middleware/request-id.ts` — will be recreated properly in Phase 4
- Delete all `reset*Instance()` functions across modules (use `container.reset()` instead)

### File Changes

- **New**: `core/crypto/encryption.service.ts`, `socket/socket-server.service.ts`, `modules/draft/lib/ai-client-factory.ts`, `middleware/auth-middleware.service.ts`
- **Modify**: `modules/build/build.module.ts`, `modules/draft/draft.module.ts`, `modules/organization/service.ts`, `modules/container/lib/docker.service.ts`, `middleware/auth.ts`, all 3 socket namespaces
- **Delete**: `crypto/aes.ts` global state pattern, module-level `let` singletons, `core/interfaces/IAIService`, `core/interfaces/IGitProvider`, all `reset*Instance()` functions, `middleware/request-id.ts`

### Risk

- Large number of files modified. Must run full E2E suite after each sub-change.
- Socket.IO namespace refactoring affects real-time features — test thoroughly.

---

## Phase 3: Module Boundary Enforcement

**Goal**: Modules communicate through Service facades, not by importing other modules' Repositories.

**Current state**: Services directly import Repositories from other modules. No module index.ts exports control. PermissionService imports 3 Repositories from 3 different modules.

### Changes

#### 3.1 Module export boundaries

Each module's `index.ts` exports only:
- Service class
- Controller class
- Route factory function
- Module registration function
- Zod schemas (for cross-module validation reuse)

Repositories and internal `lib/` files are **not exported**. Other modules cannot `import { ProjectRepository } from '../project'`.

#### 3.2 Cross-module dependency replacement

| Current | Replacement |
|---------|-------------|
| `BuildService → ProjectRepository` | `BuildService → ProjectService.getProjectById()` |
| `ContainerService → ClaudeConfigRepository` | `ContainerService → ClaudeConfigService.getConfig()` |
| `DraftService → ProjectRepository` | `DraftService → ProjectService.getProject()` |
| `DraftService → AuthRepository` | `DraftService → AuthService.findEmailById()` |
| `PermissionService → AuthRepository` | `PermissionService → AuthService.isSuperAdmin()` |
| `PermissionService → OrganizationRepository` | `PermissionService → OrganizationService.getOrgRole()` |
| `PermissionService → ProjectRepository` | `PermissionService → ProjectService.getProjectRole()` |

If the target Service doesn't expose the needed method, add it to the Service first.

#### 3.3 Lint rule

Add ESLint `no-restricted-imports` rule:
```js
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": ["**/modules/*/repo*", "**/modules/*/repository*"]
    }]
  }
}
```
This prevents future Repository imports across modules.

### File Changes

- **Modify**: All module `index.ts` barrel exports
- **Modify**: `BuildService`, `ContainerService`, `DraftService`, `PermissionService` dependencies
- **Modify**: `ProjectService`, `AuthService`, `OrganizationService`, `ClaudeConfigService` — add facade methods
- **New**: ESLint config update

### Risk

- Some Services may need new facade methods that didn't exist. Verify each call chain still works.
- PermissionService refactoring is sensitive — must preserve exact permission semantics.

---

## Phase 4: Runtime Reliability

**Goal**: Fix fire-and-forget build, wire request-id, unify pagination, add structured logging.

### Changes

#### 4.1 Build failure notification

`BuildManager.startBuild()` catch block currently only logs. Change to:
```typescript
.catch(async (error) => {
  await this.buildRepo.updateStatus(build.id, 'failed', error.message);
  this.socketServer.broadcastBuildStatus(projectId, build.id, 'failed');
});
```
Add `buildFailed` Socket.IO event to project namespace. Clients receive push notification on failure instead of polling.

#### 4.2 Request-id middleware

Rewrite `middleware/request-id.ts` using Express middleware pattern. Wire into `createApp()` before auth middleware. Update `express.d.ts` type augmentation to include `requestId: string`. Error handler reads `req.requestId` with proper typing.

#### 4.3 Unified pagination

All list endpoints accept `?page=1&limit=20` query parameters via `validateQuery` Zod schema:
```typescript
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.DEFAULT).default(PAGINATION_LIMITS.DEFAULT),
});
```
Controllers merge pagination schema with domain-specific query schemas. Repositories use `LIMIT/OFFSET` from pagination params.

Endpoints to update:
- `GET /api/projects` — findByUserId with pagination
- `GET /api/organizations` — findByUserId with pagination
- `GET /api/builds` — findByProjectId (already has limit)
- `GET /api/drafts/messages` — findMessages (already has limit)

#### 4.4 Structured request-context logging

`LoggerService.withContext(ctx)` returns a pino child logger with merged context. In `createApp()` middleware chain, after request-id and auth middleware:
```typescript
app.use((req, res, next) => {
  req.log = logger.withContext({ requestId: req.requestId, userId: req.userId });
  next();
});
```
Controllers pass `req.log` to service method calls that need request context. Services that don't need per-request context continue using their injected logger. Error handler uses structured `req.log.error()` instead of string concatenation.

### File Changes

- **Modify**: `build/service.ts`, `build/build.module.ts` — add socket broadcast on failure
- **Modify**: `socket/namespaces/project.ts` — add buildFailed event
- **New (rewrite)**: `middleware/request-id.ts` — rewritten from scratch and wired into app
- **Modify**: `src/index.ts` — add request-id and log-context middleware
- **Modify**: `src/types/express.d.ts` — add requestId and log types
- **Modify**: `core/logger/logger.ts` — add withContext method
- **Modify**: `core/errors/handler.ts` — use req.log.error
- **Modify**: All list Controllers and Repositories — add pagination
- **New**: `core/database/pagination.ts` — pagination schema and types

### Risk

- Pagination changes affect all list API responses — clients must adapt to new `meta.totalPages` / `meta.page` format.
- Request logging middleware requires Express Request type augmentation — must not conflict with existing `userId` augmentation.

---

## Phase Execution Order & Dependencies

```
Phase 1 (Schema) → Phase 2 (DI) → Phase 3 (Boundaries) → Phase 4 (Runtime)
```

Each phase must complete and pass E2E tests before the next begins. Phase 2 and 3 have the most file churn — consider splitting Phase 2 into sub-phases (2a: global state removal, 2b: middleware DI, 2c: dead code cleanup).

---

## Non-Goals

- Internationalization of error messages (deferred)
- Replacing tsyringe with another DI system (current decision: keep and converge)
- Database engine change (SQLite remains)
- API versioning or backwards-compatibility shims