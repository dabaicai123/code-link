# Server Architecture Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate architectural flaws in packages/server/ that threaten maintainability and runtime reliability, across 4 incremental phases.

**Architecture:** Phase 1 replaces hand-written SQL schema with Drizzle Kit migrations. Phase 2 eliminates all module-level global mutable singletons by converging them into tsyringe DI. Phase 3 enforces module boundaries by replacing cross-module Repository imports with Service facade calls. Phase 4 fixes runtime issues: build failure notification, request-id middleware, pagination, and structured logging.

**Tech Stack:** TypeScript, Express 4, Socket.IO, tsyringe DI, Drizzle ORM + Drizzle Kit, better-sqlite3, Zod 4, pino

---

## Phase 1: Schema Unification

### Task 1: Fix Drizzle schema discrepancies before generating migrations

Before `drizzle-kit generate` can produce correct migration SQL, the Drizzle schema must match the actual database structure. Two constraints are missing from the Drizzle schema that exist in the hand-written SQL.

**Files:**
- Modify: `packages/server/src/db/schema/tokens.ts`
- Modify: `packages/server/src/db/schema/drafts.ts`
- Modify: `packages/server/src/db/schema/users.ts` (add indexes)
- Modify: `packages/server/src/db/schema/organizations.ts` (add indexes)
- Modify: `packages/server/src/db/schema/projects.ts` (add indexes)
- Modify: `packages/server/src/db/schema/builds.ts` (add indexes)
- Modify: `packages/server/src/db/schema/repos.ts` (add indexes)
- Test: `packages/server/tests/` (existing E2E tests)

- [ ] **Step 1: Add missing UNIQUE constraint to `project_tokens`**

In `packages/server/src/db/schema/tokens.ts`, add `unique()` on `userId + provider`:

```typescript
import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const projectTokens = sqliteTable('project_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'gitlab'] }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  userProviderUnique: unique().on(table.userId, table.provider),
}));

export type InsertProjectToken = typeof projectTokens.$inferInsert;
export type SelectProjectToken = typeof projectTokens.$inferSelect;
```

- [ ] **Step 2: Add missing UNIQUE constraint to `draft_members`**

In `packages/server/src/db/schema/drafts.ts`, add `unique()` on `draftId + userId` for the `draftMembers` table:

```typescript
export const draftMembers = sqliteTable('draft_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'participant'] }).notNull(),
  joinedAt: text('joined_at').notNull().default(sql`datetime('now')`),
}, (table) => ({
  draftUserUnique: unique().on(table.draftId, table.userId),
}));
```

- [ ] **Step 3: Add indexes to Drizzle schema**

The hand-written SQL in `init.ts` creates indexes that are missing from Drizzle schema. Add them to each table file:

In `packages/server/src/db/schema/users.ts`, add at end:
```typescript
import { index } from 'drizzle-orm/sqlite-core';

export const userEmailIndex = index('idx_users_email').on(users.email);
```

In `packages/server/src/db/schema/organizations.ts`, add:
```typescript
import { index } from 'drizzle-orm/sqlite-core';

export const orgMemberOrgIndex = index('idx_org_members_org_id').on(organizationMembers.organizationId);
export const orgMemberUserIndex = index('idx_org_members_user_id').on(organizationMembers.userId);
export const orgInvitationOrgIndex = index('idx_org_invitations_org_id').on(organizationInvitations.organizationId);
export const orgInvitationEmailIndex = index('idx_org_invitations_email').on(organizationInvitations.email);
```

In `packages/server/src/db/schema/projects.ts`, add:
```typescript
import { index } from 'drizzle-orm/sqlite-core';

export const projectOrgIndex = index('idx_projects_org_id').on(projects.organizationId);
```

In `packages/server/src/db/schema/builds.ts`, add:
```typescript
import { index } from 'drizzle-orm/sqlite-core';

export const buildProjectIndex = index('idx_builds_project_id').on(builds.projectId);
```

In `packages/server/src/db/schema/repos.ts`, add:
```typescript
import { index } from 'drizzle-orm/sqlite-core';

export const repoProjectIndex = index('idx_project_repos_project_id').on(projectRepos.projectId);
```

- [ ] **Step 4: Update schema barrel exports to include indexes**

In `packages/server/src/db/schema/index.ts`, add export lines for all new indexes:

```typescript
// Indexes
export { userEmailIndex } from './users.js';
export { orgMemberOrgIndex, orgMemberUserIndex, orgInvitationOrgIndex, orgInvitationEmailIndex } from './organizations.js';
export { projectOrgIndex } from './projects.js';
export { buildProjectIndex } from './builds.js';
export { repoProjectIndex } from './repos.js';
```

- [ ] **Step 5: Verify the Drizzle schema matches hand-written SQL**

Run: `cd packages/server && npx drizzle-kit generate`
Expected: Migration SQL file generated in `src/db/migrations/` containing CREATE TABLE and CREATE INDEX statements matching the hand-written SQL in `init.ts`.

Compare the generated SQL against the hand-written SQL in `src/db/init.ts` to verify they match. Fix any remaining discrepancies.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/schema/
git commit -m "feat(db): add missing unique constraints and indexes to Drizzle schema"
```

---

### Task 2: Generate initial Drizzle migration and create migration runner

**Files:**
- Create: `packages/server/src/db/migrations/` (generated by drizzle-kit)
- Create: `packages/server/src/db/migrate-runner.ts`
- Modify: `packages/server/src/db/index.ts`
- Modify: `packages/server/src/db/connection.ts`

- [ ] **Step 1: Generate migration SQL files**

Run: `cd packages/server && npx drizzle-kit generate`
Expected: SQL files created in `src/db/migrations/` directory with a `_migrations_journal` entry. The initial migration should contain all CREATE TABLE and CREATE INDEX statements.

Verify the generated migration file exists and contains correct SQL.

- [ ] **Step 2: Create migration runner utility**

Create `packages/server/src/db/migrate-runner.ts`:

```typescript
import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('migration-runner');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function runMigrations(db: Database.Database): void {
  // Create migrations journal table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Read and execute migration files in order
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const hash = file; // Use filename as hash for simplicity

    // Check if already applied
    const applied = db.prepare('SELECT id FROM __drizzle_migrations WHERE hash = ?').get(hash);
    if (applied) {
      logger.info(`Migration ${file} already applied, skipping`);
      continue;
    }

    logger.info(`Applying migration: ${file}`);
    db.exec(sql);
    db.prepare('INSERT INTO __drizzle_migrations (hash) VALUES (?)').run(hash);
    logger.info(`Migration ${file} applied successfully`);
  }
}
```

Note: Drizzle Kit's built-in `drizzle-kit migrate` command also creates and manages a journal. The above manual runner is for startup-time auto-migration. For production, `drizzle-kit migrate` can be run as a CLI command before server start. The manual runner covers the E2E test case where migrations must run on an in-memory DB at process start.

- [ ] **Step 3: Update `DatabaseConnection.fromSqlite()` to remove `initSchema` call**

In `packages/server/src/db/connection.ts`, the `fromSqlite()` static method doesn't call `initSchema` — that's done in `src/index.ts`. No change needed in `connection.ts` itself, but note that we'll change the callers in the next task.

- [ ] **Step 4: Update `src/db/index.ts` barrel exports**

Replace `initSchema` and migration exports with new migration runner:

```typescript
// Database Connection (DI)
export { DatabaseConnection, sql } from './connection.js';

// Database utilities (for scripts outside DI container)
export { createSqliteDb, createDrizzleDb, getDefaultDbPath } from './drizzle.js';

// Schema definitions
export * from './schema/index.js';

// Default admin initialization
export { initDefaultAdmin } from './init.js';

// Migration runner (replaces initSchema + ad-hoc migrations)
export { runMigrations } from './migrate-runner.js';
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/migrations/ packages/server/src/db/migrate-runner.ts packages/server/src/db/index.ts
git commit -m "feat(db): add Drizzle Kit migration runner replacing hand-written SQL"
```

---

### Task 3: Replace `initSchema()` calls with `runMigrations()` and delete legacy files

**Files:**
- Modify: `packages/server/src/index.ts`
- Delete: `packages/server/src/db/init.ts` (replace with thin file keeping only `initDefaultAdmin`)
- Delete: `packages/server/src/db/migration.ts`
- Delete: `packages/server/src/migrate.ts`

- [ ] **Step 1: Rewrite `src/db/init.ts` to only keep `initDefaultAdmin`**

The file currently has both `initSchema()` and `initDefaultAdmin()`. Remove `initSchema()` entirely and keep only `initDefaultAdmin`:

```typescript
import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { users } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../core/logger/index.js';
import { getConfig } from '../core/config.js';
import { DatabaseConnection } from './connection.js';

const logger = createLogger('db-init');

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

export async function initDefaultAdmin(dbConnection?: DatabaseConnection): Promise<void> {
  // ... keep existing initDefaultAdmin implementation unchanged
}
```

- [ ] **Step 2: Update `src/index.ts` to use `runMigrations` instead of `initSchema`**

In `packages/server/src/index.ts`, replace the import and both call sites:

Change import from:
```typescript
import { DatabaseConnection, initSchema, initDefaultAdmin, createSqliteDb } from './db/index.js';
```
to:
```typescript
import { DatabaseConnection, initDefaultAdmin, createSqliteDb, runMigrations } from './db/index.js';
```

In `startServer()` (around line 144-148), change:
```typescript
const sqlite = createSqliteDb();
initSchema(sqlite);
```
to:
```typescript
const sqlite = createSqliteDb();
runMigrations(sqlite);
```

In `startServerForE2E()` (around line 184-185), change:
```typescript
const sqlite = createSqliteDb(':memory:');
initSchema(sqlite);
```
to:
```typescript
const sqlite = createSqliteDb(':memory:');
runMigrations(sqlite);
```

- [ ] **Step 3: Delete `src/db/migration.ts`**

Delete the entire file. All migration logic is now handled by Drizzle Kit migrations and the `runMigrations` runner.

- [ ] **Step 4: Delete `src/migrate.ts`**

Delete the standalone migration script. Use `drizzle-kit migrate` CLI command instead for production migrations, or the `runMigrations` function at startup.

- [ ] **Step 5: Update `src/db/index.ts` to remove migration.ts exports**

Already done in Task 2 Step 4 — but verify that the old `runOrganizationMigration`, `runProjectOrganizationMigration`, `runRepoClonedMigration` exports are gone.

- [ ] **Step 6: Verify E2E tests still pass**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass. In-memory DB now uses `runMigrations` instead of `initSchema`.

- [ ] **Step 7: Commit**

```bash
git add -A packages/server/src/
git commit -m "feat(db): replace initSchema with Drizzle Kit migrations, delete legacy SQL"
```

---

## Phase 2: DI Convergence

### Task 4: Create EncryptionService to replace `crypto/aes.ts` global state

**Files:**
- Create: `packages/server/src/core/crypto/encryption.service.ts`
- Modify: `packages/server/src/crypto/aes.ts` (refactor as thin wrapper)
- Modify: `packages/server/src/core/crypto/` (new directory)
- Modify: `packages/server/src/modules/claude-config/service.ts` (switch to EncryptionService)
- Modify: `packages/server/src/modules/auth/auth.module.ts` or core module (register EncryptionService)
- Modify: `packages/server/src/socket/namespaces/terminal.ts` (switch to EncryptionService)

- [ ] **Step 1: Create `EncryptionService` class**

Create directory `packages/server/src/core/crypto/` and file `encryption.service.ts`:

```typescript
import crypto from 'crypto';
import { singleton } from 'tsyringe';
import { getConfig } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@singleton()
export class EncryptionService {
  private key: Buffer;

  constructor() {
    const config = getConfig();
    const rawKey = config.encryptionKey;
    if (!rawKey || rawKey.length < 32) {
      throw new Error('CLAUDE_CONFIG_ENCRYPTION_KEY not set or too short (min 32 chars)');
    }
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  }

  decrypt(combined: string): string {
    const parts = combined.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivHex, authTagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }

    const authTag = Buffer.from(authTagHex, 'hex');
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }

  isAvailable(): boolean {
    return !!this.key;
  }
}
```

- [ ] **Step 2: Register EncryptionService in DI**

Add to a core module registration. Create or modify `packages/server/src/core/core.module.ts`:

```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';
import { EncryptionService } from './crypto/encryption.service.js';
import { LoggerService } from './logger/logger.js';

export function registerCoreModule(): void {
  container.registerSingleton(EncryptionService);
  container.registerSingleton(LoggerService);
}
```

Call `registerCoreModule()` in `src/index.ts` `createApp()` before other module registrations.

- [ ] **Step 3: Update `ClaudeConfigService` to inject EncryptionService**

In `packages/server/src/modules/claude-config/service.ts`, change:

```typescript
import { EncryptionService } from '../../core/crypto/encryption.service.js';

@singleton()
export class ClaudeConfigService {
  constructor(
    @inject(ClaudeConfigRepository) private readonly repo: ClaudeConfigRepository,
    @inject(EncryptionService) private readonly encryption: EncryptionService
  ) {}

  async getConfig(userId: number): Promise<ClaudeConfigResponse> {
    const row = await this.repo.findByUserId(userId);
    if (!row) {
      return { config: DEFAULT_CONFIG, hasConfig: false };
    }
    try {
      const config = JSON.parse(this.encryption.decrypt(row.config));
      return { config, hasConfig: true };
    } catch (error) {
      logger.error('Failed to decrypt user config', error instanceof Error ? error : new Error(String(error)));
      throw new Error('配置解密失败');
    }
  }

  async saveConfig(userId: number, config: ClaudeConfig): Promise<void> {
    if (!config.env?.ANTHROPIC_AUTH_TOKEN) {
      throw new ParamError('ANTHROPIC_AUTH_TOKEN 不能为空');
    }
    try {
      const encryptedConfig = this.encryption.encrypt(JSON.stringify(config));
      await this.repo.upsert(userId, encryptedConfig);
    } catch (error) {
      logger.error('Failed to save user config', error instanceof Error ? error : new Error(String(error)));
      throw new Error('保存配置失败');
    }
  }

  // ... keep other methods, remove isEncryptionAvailable() (now use this.encryption.isAvailable())
}
```

- [ ] **Step 4: Update terminal namespace to inject EncryptionService**

In `packages/server/src/socket/namespaces/terminal.ts`, replace:
```typescript
import { decrypt, isEncryptionKeySet } from '../../crypto/aes.js';
```
with lazy DI resolution:
```typescript
import { EncryptionService } from '../../core/crypto/encryption.service.js';

let _encryptionService: EncryptionService | null = null;
function getEncryptionService() { return _encryptionService ??= container.resolve(EncryptionService); }
```

Replace all `decrypt(...)` calls with `getEncryptionService().decrypt(...)`.
Replace all `isEncryptionKeySet()` calls with `getEncryptionService().isAvailable()`.

- [ ] **Step 5: Update `src/index.ts` to remove `setEncryptionKey` and add core module registration**

In `src/index.ts`, remove the `setEncryptionKey` import/call if present. Add `registerCoreModule()` call in `createApp()`.

Also remove `initAIClient()` call — this will be handled by AIClientFactory in Task 7.

- [ ] **Step 6: Delete `crypto/aes.ts` module-level state**

The file `packages/server/src/crypto/aes.ts` can be kept for backward compatibility during transition, but remove all module-level mutable state (`let encryptionKey`, `setEncryptionKey`, `isEncryptionKeySet`). Keep only the `encrypt` and `decrypt` functions as standalone utilities (they will be fully replaced once all callers use EncryptionService).

Alternatively, delete the entire file once all callers are migrated.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/core/crypto/ packages/server/src/modules/claude-config/service.ts packages/server/src/socket/namespaces/terminal.ts packages/server/src/index.ts
git commit -m "feat(di): create EncryptionService, replace crypto/aes.ts global state"
```

---

### Task 5: Create SocketServerService to replace `socket/index.ts` global state

**Files:**
- Create: `packages/server/src/socket/socket-server.service.ts`
- Modify: `packages/server/src/socket/index.ts`
- Modify: `packages/server/src/socket/namespaces/project.ts`
- Modify: `packages/server/src/socket/namespaces/draft.ts`
- Modify: `packages/server/src/socket/namespaces/terminal.ts`

- [ ] **Step 1: Create `SocketServerService` class**

Create `packages/server/src/socket/socket-server.service.ts`:

```typescript
import { singleton } from 'tsyringe';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('socket-server');

@singleton()
export class SocketServerService {
  private io: Server | null = null;

  create(httpServer: HttpServer): Server {
    if (this.io) return this.io;

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    logger.info('Socket.IO server created');
    return this.io;
  }

  getServer(): Server {
    if (!this.io) throw new Error('Socket server not initialized');
    return this.io;
  }

  close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}
```

- [ ] **Step 2: Register SocketServerService in DI**

Add `SocketServerService` registration. Create `packages/server/src/socket/socket.module.ts`:

```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';
import { SocketServerService } from './socket-server.service.js';

export function registerSocketModule(): void {
  container.registerSingleton(SocketServerService);
}
```

Call `registerSocketModule()` in `src/index.ts` `createApp()`.

- [ ] **Step 3: Refactor `socket/index.ts` to use SocketServerService**

Remove module-level `ioInstance`, `connectionAttempts`, `getSocketServer`, `closeSocketServer`, `resetSocketServerInstance`. The `createSocketServer` function becomes:

```typescript
import { SocketServerService } from './socket-server.service.js';

export function createSocketServer(httpServer: HttpServer): Server {
  const socketService = container.resolve(SocketServerService);
  const io = socketService.create(httpServer);

  io.use(createAuthMiddleware());

  setupProjectNamespace(io.of('/project'));
  setupDraftNamespace(io.of('/draft'));
  setupTerminalNamespace(io.of('/terminal'));
  setupCleanupInterval();

  return io;
}
```

Move the rate-limit logic into `SocketServerService` or keep it as middleware inside `createSocketServer`.

- [ ] **Step 4: Update namespace files to use SocketServerService for broadcast**

For `project.ts` and `draft.ts`, the `broadcastBuildStatus` and `broadcastDraftMessage` functions currently take a `Namespace` parameter directly. These can remain as they are — the callers in `src/index.ts` already pass the namespace reference. No changes needed to the broadcast function signatures.

For `terminal.ts`, replace `container.resolve(DockerService)` lazy resolution with injected `SocketServerService` (for sending events back through sockets).

- [ ] **Step 5: Update `src/index.ts` startServer flow**

In `startServer()`, after creating the HTTP server:
```typescript
const socketService = container.resolve(SocketServerService);
const io = socketService.create(httpServer);
// ... setup namespaces as before
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/socket/
git commit -m "feat(di): create SocketServerService, replace socket global state"
```

---

### Task 6: Register PortManager as DI singleton

**Files:**
- Modify: `packages/server/src/modules/build/lib/port-manager.ts`
- Modify: `packages/server/src/modules/build/build.module.ts`

- [ ] **Step 1: Add `@singleton()` decorator to PortManager**

In `packages/server/src/modules/build/lib/port-manager.ts`, add:

```typescript
import { singleton } from 'tsyringe';

@singleton()
export class PortManager {
  // ... existing implementation unchanged
}
```

Remove the module-level `let portManagerInstance`, `getPortManager()`, and `resetPortManagerInstance()` functions at the bottom of the file.

- [ ] **Step 2: Register PortManager in build module**

In `packages/server/src/modules/build/build.module.ts`, the `PortManager` is already not registered. Add it:

```typescript
import { PortManager } from './lib/port-manager.js';

export function registerBuildModule(): void {
  container.registerSingleton(BuildRepository);
  container.registerSingleton(BuildManager);
  container.registerSingleton(PreviewContainerManager);
  container.registerSingleton(PortManager);
  container.registerSingleton(BuildService);
  container.registerSingleton(BuildController);
}
```

- [ ] **Step 3: Update all callers of `getPortManager()`**

Search for `getPortManager` imports and replace with DI injection. The main caller is likely `BuildManager` or `PreviewContainerManager`. Inject `PortManager` via constructor:

```typescript
@inject(PortManager) private readonly portManager: PortManager
```

Replace `getPortManager()` calls with `this.portManager`.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/modules/build/
git commit -m "feat(di): register PortManager as tsyringe singleton"
```

---

### Task 7: Create AIClientFactory to replace `draft/lib/client.ts` global state

**Files:**
- Create: `packages/server/src/core/ai/ai-client-factory.ts`
- Modify: `packages/server/src/modules/draft/lib/commands.ts`
- Modify: `packages/server/src/modules/draft/draft.module.ts`
- Modify: `packages/server/src/index.ts` (remove `initAIClient` call)
- Modify: `packages/server/src/modules/draft/service.ts` (if it uses AI client)

- [ ] **Step 1: Create `AIClientFactory` class**

Create `packages/server/src/core/ai/ai-client-factory.ts`:

```typescript
import { singleton } from 'tsyringe';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('ai-client');

export interface AIResponse {
  content: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

@singleton()
export class AIClientFactory {
  private client: Anthropic | null = null;

  constructor() {
    const config = getConfig();
    if (config.anthropicApiKey) {
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
      logger.info('AI client initialized');
    } else {
      logger.warn('ANTHROPIC_API_KEY not set. AI commands disabled.');
    }
  }

  getClient(): Anthropic | null {
    return this.client;
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async sendMessage(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('AI client not initialized');
    }

    const { system, maxTokens = 4096, temperature = 0.7 } = options;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content: textContent,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
```

Note: `getConfig()` needs an `anthropicApiKey` field. Add it to `packages/server/src/core/config.ts` Zod schema:

```typescript
anthropicApiKey: z.string().optional(),
```
mapped from `process.env.ANTHROPIC_API_KEY`.

- [ ] **Step 2: Register AIClientFactory in core module**

Add to `packages/server/src/core/core.module.ts`:

```typescript
import { AIClientFactory } from './ai/ai-client-factory.js';

export function registerCoreModule(): void {
  container.registerSingleton(EncryptionService);
  container.registerSingleton(LoggerService);
  container.registerSingleton(AIClientFactory);
}
```

- [ ] **Step 3: Update `draft/lib/commands.ts` to use AIClientFactory**

Replace `import { isAIEnabled, sendAIMessage } from './client.js'` with injection. Since `commands.ts` is a utility module (not a class), it needs to receive `AIClientFactory` from its caller `DraftService`.

In `packages/server/src/modules/draft/service.ts`, inject `AIClientFactory`:

```typescript
@inject(AIClientFactory) private readonly aiClient: AIClientFactory
```

Pass it to `executeAICommand` calls. Update `executeAICommand` function signature to accept `AIClientFactory` instead of using the global `sendAIMessage`.

- [ ] **Step 4: Remove `initAIClient()` from `src/index.ts`**

Remove the `import { initAIClient }` and the `initAIClient()` call from `startServer()`. The `AIClientFactory` constructor handles initialization automatically via `getConfig()`.

- [ ] **Step 5: Delete `draft/lib/client.ts`**

Delete `packages/server/src/modules/draft/lib/client.ts` entirely. Its types (`AIResponse`, `AIMessage`, `AIRequestOptions`) are now in `AIClientFactory`.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/core/ai/ packages/server/src/core/core.module.ts packages/server/src/modules/draft/ packages/server/src/index.ts
git commit -m "feat(di): create AIClientFactory, replace draft/lib/client.ts global state"
```

---

### Task 8: DockerService decoupling — constructor injection of Dockerode options

**Files:**
- Modify: `packages/server/src/modules/container/lib/docker.service.ts`
- Modify: `packages/server/src/modules/container/container.module.ts`

- [ ] **Step 1: Modify DockerService to accept config in constructor**

In `packages/server/src/modules/container/lib/docker.service.ts`, change:

```typescript
import { singleton } from 'tsyringe';
import Docker from 'dockerode';
import type { DockerOptions } from 'dockerode';
import { getConfig } from '../../../core/config.js';
// ... other imports

@singleton()
export class DockerService implements IDockerService {
  private client: Docker;

  constructor() {
    const config = getConfig();
    const dockerOptions: DockerOptions = {
      // Default to local Docker socket, allow env override
      ...(config.dockerHost ? { host: config.dockerHost, port: config.dockerPort } : {}),
    };
    this.client = new Docker(dockerOptions);
  }
  // ... all existing methods unchanged
}
```

Note: This doesn't inject a `Docker` instance — it injects configuration. The Docker client is still created internally, but from config rather than hardcoded `new Docker()`. This makes the Docker host/port configurable and the constructor deterministic.

Add `dockerHost` and `dockerPort` to `packages/server/src/core/config.ts` Zod schema if they don't already exist (they likely do since the env file mentions Docker settings).

- [ ] **Step 2: Update container module registration if needed**

The `container.registerSingleton(DockerService)` call in `container.module.ts` already works with `@singleton()`. No change needed unless we want to use `container.register(IDockerService, DockerService)` for interface-based injection. This is optional for now.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/container/ packages/server/src/core/config.ts
git commit -m "feat(di): DockerService reads config from DI instead of hardcoded new Docker()"
```

---

### Task 9: OrganizationService → use PermissionService for super-admin checks

**Files:**
- Modify: `packages/server/src/modules/organization/service.ts`
- Modify: `packages/server/src/modules/organization/organization.module.ts`

- [ ] **Step 1: Replace AuthRepository injection with PermissionService in OrganizationService**

In `packages/server/src/modules/organization/service.ts`, change constructor:

```typescript
@singleton()
export class OrganizationService {
  constructor(
    @inject(OrganizationRepository) private readonly repo: OrganizationRepository,
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}
```

- [ ] **Step 2: Replace all super-admin check patterns**

Every method that has:
```typescript
const userEmail = await this.userRepo.findEmailById(userId);
const config = getConfig();
const isAdmin = userEmail && config.adminEmails?.includes(userEmail);
```

Replace with:
```typescript
const isAdmin = await this.permService.isSuperAdmin(userId);
```

The `PermissionService.isSuperAdmin()` method already does exactly this check. Remove the `getConfig()` import from `service.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/organization/
git commit -m "feat(di): OrganizationService uses PermissionService instead of duplicated super-admin checks"
```

---

### Task 10: Create AuthMiddlewareService to formalize middleware DI

**Files:**
- Create: `packages/server/src/middleware/auth-middleware.service.ts`
- Modify: `packages/server/src/middleware/auth.ts`
- Modify: `packages/server/src/core/core.module.ts` (or middleware module)

- [ ] **Step 1: Create `AuthMiddlewareService` class**

Create `packages/server/src/middleware/auth-middleware.service.ts`:

```typescript
import { singleton, inject } from 'tsyringe';
import { AuthRepository } from '../modules/auth/repository.js';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { ROLE_HIERARCHY } from '../utils/roles.js';
import { Errors } from '../core/errors/index.js';
import { getConfig } from '../core/config.js';
import type { OrgRole } from '../db/schema/index.js';

@singleton()
export class AuthMiddlewareService {
  constructor(
    @inject(AuthRepository) private readonly authRepo: AuthRepository,
    @inject(OrganizationRepository) private readonly orgRepo: OrganizationRepository,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository
  ) {}

  async verifyToken(token: string): Promise<number> {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload !== 'object' || payload === null || typeof (payload as any).userId !== 'number') {
      throw new AuthError('无效的令牌');
    }
    return (payload as any).userId;
  }

  async checkOrgMembership(userId: number, orgId: number, minRole: OrgRole): Promise<void> {
    if (await isSuperAdmin(userId)) return;
    const member = await this.orgRepo.findMember(orgId, userId);
    if (!member) throw new Errors.ForbiddenError('您不是该组织的成员');
    if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[minRole]) {
      throw new Errors.ForbiddenError('权限不足');
    }
  }

  async checkProjectMembership(userId: number, projectId: number, minRole: OrgRole): Promise<void> {
    if (await isSuperAdmin(userId)) return;
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw new Errors.NotFoundError('项目');
    await this.checkOrgMembership(userId, project.organizationId, minRole);
  }

  async canCreateOrg(userId: number): Promise<void> {
    if (await isSuperAdmin(userId)) return;
    const orgs = await this.orgRepo.findByUserId(userId);
    const isOwner = orgs.some(o => o.role === 'owner');
    if (!isOwner) throw new Errors.ForbiddenError('只有组织 owner 或管理员可以创建组织');
  }
}
```

- [ ] **Step 2: Refactor `middleware/auth.ts` to use AuthMiddlewareService**

Remove the module-level `getAuthRepo`, `getOrgRepo`, `getProjectRepo` lazy resolution functions. Instead, resolve `AuthMiddlewareService` once:

```typescript
import { container } from 'tsyringe';
import { AuthMiddlewareService } from './auth-middleware.service.js';

function getAuthService(): AuthMiddlewareService {
  return container.resolve(AuthMiddlewareService);
}
```

Then in `authMiddleware`, `createOrgMemberMiddleware`, `createProjectMemberMiddleware`, `createCanCreateOrgMiddleware`, delegate all repository/permission checks to `getAuthService()` methods.

The middleware functions remain as Express middleware factories — they just call service methods instead of doing raw repository queries.

- [ ] **Step 3: Register AuthMiddlewareService in DI**

Add to `packages/server/src/core/core.module.ts`:

```typescript
import { AuthMiddlewareService } from '../middleware/auth-middleware.service.js';

export function registerCoreModule(): void {
  container.registerSingleton(EncryptionService);
  container.registerSingleton(LoggerService);
  container.registerSingleton(AIClientFactory);
  container.registerSingleton(AuthMiddlewareService);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/middleware/ packages/server/src/core/core.module.ts
git commit -m "feat(di): create AuthMiddlewareService, remove container.resolve per-request in auth middleware"
```

---

### Task 11: Dead code cleanup — delete unused interfaces and reset functions

**Files:**
- Delete: `packages/server/src/core/interfaces/ai.interface.ts` (IAIService never implemented)
- Delete: `packages/server/src/core/interfaces/git-provider.interface.ts` (IGitProvider never implemented)
- Modify: `packages/server/src/core/interfaces/index.ts` (remove deleted exports)
- Delete: `packages/server/src/middleware/request-id.ts` (will be rewritten in Phase 4)
- Modify: various files that export `reset*Instance()` functions

- [ ] **Step 1: Delete IAIService interface file**

Delete `packages/server/src/core/interfaces/ai.interface.ts`. The `AIClientFactory` from Task 7 provides equivalent functionality.

- [ ] **Step 2: Delete IGitProvider interface file**

Delete `packages/server/src/core/interfaces/git-provider.interface.ts`. `GitHubClient` and `GitLabClient` are concrete classes without interface abstraction.

- [ ] **Step 3: Update `core/interfaces/index.ts`**

Remove deleted exports:
```typescript
export { IDockerService } from './docker.interface.js';
// IAIService and IGitProvider exports removed
```

- [ ] **Step 4: Delete `middleware/request-id.ts`**

Delete `packages/server/src/middleware/request-id.ts`. It will be rewritten properly in Phase 4 Task 14.

- [ ] **Step 5: Remove all `reset*Instance()` functions**

Search for and remove:
- `resetPortManagerInstance` in `packages/server/src/modules/build/lib/port-manager.ts` (already removed in Task 6)
- `resetSocketServerInstance` in `packages/server/src/socket/index.ts` (already removed in Task 5)
- `resetRoomUsers` in `packages/server/src/socket/utils/room-manager.ts` — keep this one since room-manager is pure state management, not a DI class. It's legitimately needed for test cleanup.
- Any test files that call these reset functions need to be updated to use `container.reset()` or direct state reset on the new services.

- [ ] **Step 6: Commit**

```bash
git add -A packages/server/src/core/interfaces/ packages/server/src/middleware/request-id.ts
git commit -m "cleanup: delete unused IAIService, IGitProvider interfaces and request-id middleware"
```

---

## Phase 3: Module Boundary Enforcement

### Task 12: Define module export boundaries (barrel exports)

**Files:**
- Modify: `packages/server/src/modules/auth/auth.module.ts`
- Modify: `packages/server/src/modules/build/build.module.ts`
- Modify: `packages/server/src/modules/container/container.module.ts`
- Modify: `packages/server/src/modules/claude-config/claude-config.module.ts`
- Modify: `packages/server/src/modules/draft/draft.module.ts`
- Modify: `packages/server/src/modules/gitprovider/gitprovider.module.ts`
- Modify: `packages/server/src/modules/organization/organization.module.ts`
- Modify: `packages/server/src/modules/project/project.module.ts`

- [ ] **Step 1: Update each module's barrel exports to hide Repository**

For each module, update the `index.ts` or `.module.ts` file to only export:
- Service class
- Controller class
- Route factory function
- Module registration function
- Zod schemas and types (for cross-module validation reuse)

**Remove** Repository exports from all module barrel files. Example for `auth.module.ts`:

```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';
import { AuthRepository } from './repository.js';
import { AuthService } from './service.js';
import { AuthController } from './controller.js';

export function registerAuthModule(): void {
  container.registerSingleton(AuthRepository);
  container.registerSingleton(AuthService);
  container.registerSingleton(AuthController);
}

// Only export Service, Controller, routes, schemas, types
export { AuthService } from './service.js';
export { AuthController } from './controller.js';
export { createAuthRoutes } from './routes.js';
export { registerSchema, loginSchema } from './schemas.js';
export type { RegisterInput, LoginInput } from './schemas.js';
export type { AuthResult, UserWithoutPassword } from './types.js';

// Repository is NOT exported — only accessible within this module
```

Apply this pattern to all 8 modules.

- [ ] **Step 2: Verify that internal module files still import Repository directly**

Within each module, `service.ts` can still import its own `repository.ts` via relative path. The boundary is only about cross-module imports.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/
git commit -m "feat(boundary): restrict module exports to Service/Controller only, hide Repository"
```

---

### Task 13: Replace cross-module Repository imports with Service facade calls

**Files:**
- Modify: `packages/server/src/modules/build/service.ts`
- Modify: `packages/server/src/modules/container/service.ts`
- Modify: `packages/server/src/modules/draft/service.ts`
- Modify: `packages/server/src/shared/permission.service.ts`
- Modify: `packages/server/src/modules/project/service.ts` (add facade methods)
- Modify: `packages/server/src/modules/auth/service.ts` (add facade methods)
- Modify: `packages/server/src/modules/organization/service.ts` (add facade methods)
- Modify: `packages/server/src/modules/claude-config/service.ts` (add facade methods)

- [ ] **Step 1: Add facade methods to target Services**

Add these methods to the Service classes that other modules need:

**`AuthService`** — add `findEmailById` and `isSuperAdmin` facade:
```typescript
async findEmailById(userId: number): Promise<string | null> {
  const user = await this.repo.findById(userId);
  return user?.email ?? null;
}

async isSuperAdmin(userId: number): Promise<boolean> {
  const email = await this.findEmailById(userId);
  const config = getConfig();
  return email ? config.adminEmails?.includes(email) ?? false : false;
}
```

**`ProjectService`** — add `getProjectById` facade:
```typescript
async getProjectById(projectId: number): Promise<SelectProject | null> {
  return this.repo.findById(projectId);
}
```

**`OrganizationService`** — add `getOrgRole` facade:
```typescript
async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
  const member = await this.repo.findMember(orgId, userId);
  return member?.role ?? null;
}
```

**`ClaudeConfigService`** — already has `hasConfig(userId)` method. No new method needed.

- [ ] **Step 2: Replace `BuildService` cross-module Repository import**

In `packages/server/src/modules/build/service.ts`, replace:
```typescript
import { ProjectRepository } from '../project/repository.js';
@inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
```
with:
```typescript
import { ProjectService } from '../project/index.js';
@inject(ProjectService) private readonly projectService: ProjectService,
```

Replace `this.projectRepo.findById(...)` calls with `this.projectService.getProjectById(...)`. (Note: BuildService currently only uses ProjectRepository via `PermissionService.checkProjectAccess` — check if it actually calls `projectRepo` directly beyond what PermissionService provides.)

- [ ] **Step 3: Replace `ContainerService` cross-module Repository imports**

In `packages/server/src/modules/container/service.ts`, replace:
```typescript
import { ProjectRepository } from '../project/repository.js';
import { ClaudeConfigRepository } from '../claude-config/repository.js';
@inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
@inject(ClaudeConfigRepository) private readonly claudeConfigRepo: ClaudeConfigRepository,
```
with:
```typescript
import { ProjectService } from '../project/index.js';
import { ClaudeConfigService } from '../claude-config/index.js';
@inject(ProjectService) private readonly projectService: ProjectService,
@inject(ClaudeConfigService) private readonly claudeConfigService: ClaudeConfigService,
```

Replace `this.projectRepo.updateStatus(...)` → `this.projectService.updateStatus(...)` (need to add this method to ProjectService).
Replace `this.projectRepo.updateContainerId(...)` → `this.projectService.updateContainerId(...)` (need to add this method).
Replace `this.claudeConfigRepo.hasConfig(userId)` → `this.claudeConfigService.hasConfig(userId)`.

- [ ] **Step 4: Replace `DraftService` cross-module Repository imports**

In `packages/server/src/modules/draft/service.ts`, replace:
```typescript
import { ProjectRepository } from '../project/repository.js';
import { AuthRepository } from '../auth/repository.js';
@inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
@inject(AuthRepository) private readonly authRepo: AuthRepository,
```
with:
```typescript
import { ProjectService } from '../project/index.js';
import { AuthService } from '../auth/index.js';
@inject(ProjectService) private readonly projectService: ProjectService,
@inject(AuthService) private readonly authService: AuthService,
```

Replace all `this.projectRepo.findById(...)` → `this.projectService.getProjectById(...)`.
Replace all `this.authRepo.findById(...)` → need to add `findById` facade to AuthService (or use `getUser` which already returns `UserWithoutPassword`).

- [ ] **Step 5: Replace `PermissionService` cross-module Repository imports**

In `packages/server/src/shared/permission.service.ts`, replace:
```typescript
import { AuthRepository } from '../modules/auth/repository.js';
import { OrganizationRepository } from '../modules/organization/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
@inject(AuthRepository) private readonly userRepo: AuthRepository,
@inject(OrganizationRepository) private readonly orgRepo: OrganizationRepository,
@inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
```
with:
```typescript
import { AuthService } from '../modules/auth/index.js';
import { OrganizationService } from '../modules/organization/index.js';
import { ProjectService } from '../modules/project/index.js';
@inject(AuthService) private readonly authService: AuthService,
@inject(OrganizationService) private readonly orgService: OrganizationService,
@inject(ProjectService) private readonly projectService: ProjectService,
```

Replace `this.userRepo.findEmailById(userId)` → `this.authService.findEmailById(userId)`.
Replace `this.orgRepo.findMember(orgId, userId)` → `this.orgService.getOrgRole(userId, orgId)`.
Replace `this.projectRepo.findById(projectId)` → `this.projectService.getProjectById(projectId)`.
Replace `this.projectRepo.findByUserId(userId, orgId)` → `this.projectService.findByUserId(userId, orgId)`.

- [ ] **Step 6: Update module registrations**

Each module that now injects Services from other modules needs those modules registered first. Verify the module registration order in `createApp()` respects this dependency chain.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/modules/ packages/server/src/shared/
git commit -m "feat(boundary): replace cross-module Repository imports with Service facade calls"
```

---

### Task 14: Add ESLint no-restricted-imports rule for module boundaries

**Files:**
- Modify: `packages/server/eslint.config.js` (or `.eslintrc` depending on config format)

- [ ] **Step 1: Add ESLint rule**

In the ESLint config file for `packages/server`, add:

```javascript
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/modules/*/repository*', '**/modules/*/repo*'],
          message: 'Cross-module Repository imports are forbidden. Use the module Service facade instead.',
        },
      ],
    }],
  },
}
```

- [ ] **Step 2: Verify the rule catches existing violations**

Run: `cd packages/server && npx eslint src/`
Expected: No new errors (since all cross-module Repository imports were replaced in Task 13).

- [ ] **Step 3: Commit**

```bash
git add packages/server/eslint.config.js
git commit -m "feat(boundary): add ESLint rule forbidding cross-module Repository imports"
```

---

## Phase 4: Runtime Reliability

### Task 15: Build failure notification — update BuildManager catch block

**Files:**
- Modify: `packages/server/src/modules/build/service.ts`
- Modify: `packages/server/src/modules/build/lib/build-manager.ts` (if startBuild is there)
- Modify: `packages/server/src/socket/namespaces/project.ts` (add buildFailed event)

- [ ] **Step 1: Update BuildService.create() to notify on build failure**

In `packages/server/src/modules/build/service.ts`, change the fire-and-forget catch block:

```typescript
this.buildManager.startBuild(input.projectId, build.id).catch(async (error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Build failed', err, { projectId: input.projectId, buildId: build.id });

  // Update build status to failed
  await this.repo.updateStatus(build.id, 'failed');

  // Broadcast failure via Socket.IO
  const socketService = container.resolve(SocketServerService);
  const io = socketService.getServer();
  const projectNamespace = io.of('/project');
  broadcastBuildStatus(projectNamespace, input.projectId, build.id, 'failed', undefined, err.message);
});
```

- [ ] **Step 2: Add `updateStatus` method to BuildRepository**

In `packages/server/src/modules/build/repository.ts`, add:

```typescript
async updateStatus(buildId: number, status: string): Promise<void> {
  await this.db.update(builds)
    .set({ status })
    .where(eq(builds.id, buildId));
}
```

Note: If an `error` field is needed on the builds table, add `error: text('error')` to the `builds` Drizzle schema in `packages/server/src/db/schema/builds.ts` and generate a new migration via `drizzle-kit generate`. Otherwise, the error message is sent only via Socket.IO broadcast.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/build/
git commit -m "feat(runtime): broadcast build failure via Socket.IO instead of fire-and-forget"
```

---

### Task 16: Rewrite and wire request-id middleware

**Files:**
- Create: `packages/server/src/middleware/request-id.ts` (rewrite)
- Modify: `packages/server/src/index.ts` (wire middleware)
- Modify: `packages/server/src/types/express.d.ts` (add requestId type)
- Modify: `packages/server/src/core/errors/handler.ts` (use typed requestId)

- [ ] **Step 1: Rewrite request-id middleware**

Create `packages/server/src/middleware/request-id.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
```

- [ ] **Step 2: Update Express type augmentation**

In `packages/server/src/types/express.d.ts`, the `requestId` property already exists:

```typescript
interface Request {
  requestId?: string;  // Already defined
  userId?: number;
  orgRole?: OrgRole;
  project?: SelectProject;
  membership?: { role: OrgRole };
}
```

Make it required (non-optional) after requestIdMiddleware runs:

```typescript
interface Request {
  requestId: string;  // Set by requestIdMiddleware, always present after
  userId?: number;
  orgRole?: OrgRole;
  project?: SelectProject;
  membership?: { role: OrgRole };
}
```

- [ ] **Step 3: Wire middleware into `createApp()`**

In `packages/server/src/index.ts`, add before auth middleware:

```typescript
import { requestIdMiddleware } from './middleware/request-id.js';

// In createApp():
app.use(requestIdMiddleware);
```

- [ ] **Step 4: Update error handler to use typed requestId**

In `packages/server/src/core/errors/handler.ts`, change:

```typescript
const requestId = (req as any).requestId || 'unknown';
```
to:
```typescript
const requestId = req.requestId;
```

Since `requestId` is now guaranteed to be a `string` (never undefined).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/middleware/request-id.ts packages/server/src/types/express.d.ts packages/server/src/core/errors/handler.ts packages/server/src/index.ts
git commit -m "feat(runtime): wire request-id middleware and use typed requestId in error handler"
```

---

### Task 17: Unified pagination for list endpoints

**Files:**
- Create: `packages/server/src/core/database/pagination.ts`
- Modify: `packages/server/src/modules/project/controller.ts` and `repository.ts`
- Modify: `packages/server/src/modules/organization/controller.ts` and `repository.ts`
- Modify: `packages/server/src/modules/draft/controller.ts` and `repository.ts`
- Modify: `packages/server/src/modules/build/controller.ts` and `repository.ts`

- [ ] **Step 1: Create pagination schema and types**

Create `packages/server/src/core/database/pagination.ts`:

```typescript
import { z } from 'zod';
import { PAGINATION_LIMITS } from './constants.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.projects.max).default(PAGINATION_LIMITS.projects.default),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function computeOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function computeTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}
```

- [ ] **Step 2: Update ProjectRepository.findByUserId to support pagination**

Add `page` and `limit` parameters and return count:

```typescript
async findByUserId(userId: number, organizationId?: number, page?: number, limit?: number): Promise<{ data: SelectProject[]; total: number }> {
  const effectiveLimit = limit ?? PAGINATION_LIMITS.projects.default;
  const offset = page ? computeOffset(page, effectiveLimit) : 0;

  // Count query
  const countResult = await this.db.select({ count: sql`count(*)` })
    .from(projects)
    .where(/* existing filter */)
    .get();

  // Data query with LIMIT/OFFSET
  const data = await this.db.select()
    .from(projects)
    .where(/* existing filter */)
    .limit(effectiveLimit)
    .offset(offset);

  return { data, total: countResult?.count ?? 0 };
}
```

- [ ] **Step 3: Update ProjectController to accept pagination params**

In `packages/server/src/modules/project/controller.ts`, merge pagination schema into the list endpoint:

```typescript
async list(req: Request, res: Response): Promise<void> {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await this.service.findByUserId(req.userId!, req.query.organizationId, page, limit);

  res.json({
    data: result.data,
    meta: {
      page,
      limit,
      total: result.total,
      totalPages: computeTotalPages(result.total, limit),
    },
  });
}
```

- [ ] **Step 4: Apply same pattern to Organization, Draft, Build controllers**

Repeat Steps 2-3 for each list endpoint. Use domain-specific limit defaults from `PAGINATION_LIMITS`.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/core/database/pagination.ts packages/server/src/modules/
git commit -m "feat(runtime): unified pagination for all list endpoints"
```

---

### Task 18: Structured request-context logging

**Files:**
- Modify: `packages/server/src/core/logger/logger.ts` (add `withContext`)
- Modify: `packages/server/src/types/express.d.ts` (add `log` type)
- Modify: `packages/server/src/index.ts` (add log-context middleware)
- Modify: `packages/server/src/core/errors/handler.ts` (use `req.log`)

- [ ] **Step 1: Add `withContext` method to LoggerService**

In `packages/server/src/core/logger/logger.ts`, add:

```typescript
withContext(context: Record<string, unknown>): Logger {
  const childPino = this.logger.child(context);
  return new LoggerService(childPino);
}
```

- [ ] **Step 2: Add `log` property to Express Request type**

In `packages/server/src/types/express.d.ts`, add:

```typescript
import type { Logger } from '../core/logger/types.js';

interface Request {
  requestId: string;
  userId?: number;
  orgRole?: OrgRole;
  project?: SelectProject;
  membership?: { role: OrgRole };
  log?: Logger;
}
```

- [ ] **Step 3: Add log-context middleware in `createApp()`**

In `packages/server/src/index.ts`, after requestId and auth middleware:

```typescript
import { LoggerService } from './core/logger/logger.js';

const rootLogger = container.resolve(LoggerService);

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.log = rootLogger.withContext({
    requestId: req.requestId,
    userId: req.userId ?? 'anonymous',
  });
  next();
});
```

- [ ] **Step 4: Update error handler to use `req.log`**

In `packages/server/src/core/errors/handler.ts`, change:

```typescript
logger.warn(`[${requestId}] ${err.code}: ${err.message}`);
```
to:
```typescript
(req.log || logger).warn(`${err.code}: ${err.message}`, { requestId, code: err.code });
```

And for unexpected errors:
```typescript
logger.error(`[${requestId}] Unexpected error:`, err);
```
to:
```typescript
(req.log || logger).error('Unexpected error', err, { requestId });
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/core/logger/logger.ts packages/server/src/types/express.d.ts packages/server/src/index.ts packages/server/src/core/errors/handler.ts
git commit -m "feat(runtime): add structured request-context logging with req.log"
```

---

## Final Task: Integration verification and cleanup

### Task 19: Run full E2E test suite and fix any regressions

**Files:**
- Various (any regressions found)

- [ ] **Step 1: Run full test suite**

Run: `cd packages/server && npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 2: Fix any test failures**

Each failure needs investigation. Common issues:
- Tests that import Repository directly from other modules (barrier change)
- Tests that use `reset*Instance()` functions (DI change)
- Tests that depend on `initSchema()` (migration change)

Fix each by updating test imports and setup code.

- [ ] **Step 3: Commit any test fixes**

```bash
git add packages/server/tests/
git commit -m "test: fix test regressions from architecture changes"
```