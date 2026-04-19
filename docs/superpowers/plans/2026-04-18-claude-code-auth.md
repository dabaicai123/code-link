# Claude Code 容器鉴权实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为项目容器实现安全的 Claude Code CLI 鉴权机制，容器以非 root 用户运行，用户配置运行时注入。

**Architecture:** Dockerfile 创建 `codelink` 用户，内置权限白名单和 onboarding 跳过配置。用户 Claude 配置加密存储在数据库，终端连接时通过环境变量注入到容器 exec 进程。

**Tech Stack:** Docker, Node.js, TypeScript, SQLite, AES-256-GCM加密

---

## 文件结构

| 文件 | 负责内容 |
|------|----------|
| `packages/server/src/crypto/aes.ts` | AES-256-GCM 加密/解密工具 |
| `packages/server/src/db/schema.ts` | 新增 user_claude_configs 表 |
| `packages/server/src/routes/claude-config.ts` | 用户 Claude 配置 CRUD API |
| `packages/server/src/terminal/docker-exec.ts` | 新增 execWithUserConfig 函数 |
| `packages/server/src/terminal/terminal-manager.ts` | createSession 接收 userId 参数 |
| `packages/server/src/routes/terminal.ts` | 查询用户配置，注入环境变量 |
| `packages/server/docker/templates/claude-settings.json` | 权限白名单配置 |
| `packages/server/docker/templates/claude.json` | 跳过 onboarding 配置 |
| `packages/server/docker/templates/node/Dockerfile` | 创建 codelink 用户，内置配置 |
| `packages/server/docker/templates/node+java/Dockerfile` | 同上 |
| `packages/server/docker/templates/node+python/Dockerfile` | 同上 |
| `packages/web/src/app/settings/page.tsx` | Claude Code 配置界面 |
| `packages/web/src/components/terminal/terminal-panel.tsx` | 未配置时显示提示 |

---

## Task 1: AES-256-GCM 加密模块

**Files:**
- Create: `packages/server/src/crypto/aes.ts`
- Test: `packages/server/tests/crypto.test.ts`

- [ ] **Step 1: 写加密模块测试**

```typescript
// packages/server/tests/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, isEncryptionKeySet, setEncryptionKey } from '../src/crypto/aes.js';

describe('AES-256-GCM Crypto', () => {
  const testKey = 'test-encryption-key-32-bytes!!';

  beforeAll(() => {
    setEncryptionKey(testKey);
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = '{"env":{"ANTHROPIC_AUTH_TOKEN":"sk-test"}}';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should throw if key not set', () => {
    setEncryptionKey('');
    expect(() => encrypt('test')).toThrow('Encryption key not set');
    setEncryptionKey(testKey);
  });

  it('should throw on invalid ciphertext', () => {
    expect(() => decrypt('invalid')).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/server && pnpm test tests/crypto.test.ts
```
Expected: FAIL - module not found

- [ ] **Step 3: 写加密模块实现**

```typescript
// packages/server/src/crypto/aes.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: string | null = null;

export function setEncryptionKey(key: string): void {
  encryptionKey = key || null;
}

export function isEncryptionKeySet(): boolean {
  return encryptionKey !== null && encryptionKey.length >= 32;
}

export function encrypt(plaintext: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key not set or too short (min 32 chars)');
  }

  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 格式: iv(hex):authTag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

export function decrypt(combined: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key not set or too short (min 32 chars)');
  }

  const parts = combined.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const key = crypto.createHash('sha256').update(encryptionKey).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd packages/server && pnpm test tests/crypto.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/crypto/aes.ts packages/server/tests/crypto.test.ts
git commit -m "feat: add AES-256-GCM encryption module for user config"
```

---

## Task 2: 数据库表 schema

**Files:**
- Modify: `packages/server/src/db/schema.ts`

- [ ] **Step 1: 添加 user_claude_configs 表**

在 `initSchema` 函数的 `db.exec()` 中添加新表：

```typescript
// packages/server/src/db/schema.ts
// 在 db.exec() 的 SQL 中添加：

CREATE TABLE IF NOT EXISTS user_claude_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);
```

完整修改后的 `initSchema` 函数：

```typescript
export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_type TEXT NOT NULL CHECK (template_type IN ('node', 'node+java', 'node+python')),
      container_id TEXT,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'stopped')),
      github_repo TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'product')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'chat' CHECK (type IN ('chat', 'notification')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
      preview_port INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS project_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      repo_url TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, repo_url)
    );

    CREATE TABLE IF NOT EXISTS user_claude_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id)
    );
  `);
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat: add user_claude_configs table for storing encrypted user config"
```

---

## Task 3: Claude 配置 API 路由

**Files:**
- Create: `packages/server/src/routes/claude-config.ts`
- Modify: `packages/server/src/index.ts` (注册路由)

- [ ] **Step 1: 写 Claude 配置路由**

```typescript
// packages/server/src/routes/claude-config.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { encrypt, decrypt, isEncryptionKeySet } from '../crypto/aes.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('claude-config');

const DEFAULT_CONFIG = {
  env: {
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  },
  skipDangerousModePermissionPrompt: true,
};

export function createClaudeConfigRouter(db: Database.Database): Router {
  const router = Router();

  // 检查加密密钥是否设置
  if (!isEncryptionKeySet()) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }

  // 获取用户配置
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    const row = db
      .prepare('SELECT config FROM user_claude_configs WHERE user_id = ?')
      .get(userId) as { config: string } | undefined;

    if (!row) {
      // 返回默认模板
      res.json({ config: DEFAULT_CONFIG, hasConfig: false });
      return;
    }

    try {
      const config = JSON.parse(decrypt(row.config));
      res.json({ config, hasConfig: true });
    } catch (error) {
      logger.error('Failed to decrypt user config', error);
      res.status(500).json({ error: '配置解密失败' });
    }
  });

  // 保存用户配置
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;

    if (!config) {
      res.status(400).json({ error: '缺少 config 字段' });
      return;
    }

    // 验证 JSON 结构
    if (!config.env || typeof config.env !== 'object') {
      res.status(400).json({ error: 'config.env 必须是对象' });
      return;
    }

    // 检查必填字段
    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      res.status(400).json({ error: 'ANTHROPIC_AUTH_TOKEN 不能为空' });
      return;
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));

      // 使用 UPSERT
      db.prepare(`
        INSERT INTO user_claude_configs (user_id, config, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          config = excluded.config,
          updated_at = datetime('now')
      `).run(userId, encryptedConfig);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to save user config', error);
      res.status(500).json({ error: '保存配置失败' });
    }
  });

  // 删除用户配置
  router.delete('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    db.prepare('DELETE FROM user_claude_configs WHERE user_id = ?').run(userId);
    res.json({ success: true });
  });

  return router;
}
```

- [ ] **Step 2: 注册路由到主应用**

在 `packages/server/src/index.ts` 中添加：

```typescript
// packages/server/src/index.ts
// 在导入区域添加：
import { createClaudeConfigRouter } from './routes/claude-config.js';
import { setEncryptionKey } from './crypto/aes.js';

// 在 app.use 区域添加：
app.use('/api/claude-config', createClaudeConfigRouter(db));

// 在服务器启动前添加：
const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
if (!encryptionKey) {
  console.warn('WARNING: CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
}
setEncryptionKey(encryptionKey);
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/routes/claude-config.ts packages/server/src/index.ts
git commit -m "feat: add Claude config CRUD API with encryption"
```

---

## Task 4: Docker 配置文件

**Files:**
- Create: `packages/server/docker/templates/claude-settings.json`
- Create: `packages/server/docker/templates/claude.json`

- [ ] **Step 1: 创建权限白名单配置**

```json
// packages/server/docker/templates/claude-settings.json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(pnpm *)",
      "Bash(node *)",
      "Bash(npx *)",
      "Bash(git *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(mkdir *)",
      "Bash(rm *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Bash(pwd)",
      "Bash(which *)",
      "Bash(echo *)",
      "Bash(touch *)",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep"
    ],
    "deny": []
  }
}
```

- [ ] **Step 2: 创建 onboarding 跳过配置**

```json
// packages/server/docker/templates/claude.json
{
  "hasCompletedOnboarding": true
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/docker/templates/claude-settings.json packages/server/docker/templates/claude.json
git commit -m "feat: add Claude Code settings files for bypass permissions and onboarding skip"
```

---

## Task 5: Dockerfile 改造 (node 模板)

**Files:**
- Modify: `packages/server/docker/templates/node/Dockerfile`
- Modify: `packages/server/docker/templates/node/entrypoint.sh`

- [ ] **Step 1: 改造 node Dockerfile**

```dockerfile
# packages/server/docker/templates/node/Dockerfile
FROM node:20-slim

# 安装基础工具
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 -s /bin/bash codelink

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 预置 Claude Code 配置目录
RUN mkdir -p /home/codelink/.claude && \
    chown -R codelink:codelink /home/codelink/.claude

# 内置 settings.json（bypass 权限白名单）
COPY claude-settings.json /home/codelink/.claude/settings.json
RUN chown codelink:codelink /home/codelink/.claude/settings.json

# 内置 ~/.claude.json（跳过 onboarding）
COPY claude.json /home/codelink/.claude.json
RUN chown codelink:codelink /home/codelink/.claude.json

# 创建工作目录并授权
WORKDIR /workspace
RUN chown -R codelink:codelink /workspace

# 切换到非 root 用户
USER codelink

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 2: 修改 entrypoint.sh 确保以 codelink 用户运行**

```bash
# packages/server/docker/templates/node/entrypoint.sh
#!/bin/bash

# 保持容器运行
exec tail -f /dev/null
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/docker/templates/node/Dockerfile packages/server/docker/templates/node/entrypoint.sh
git commit -m "feat: create non-root codelink user in node template with Claude settings"
```

---

## Task 6: Dockerfile 改造 (node+java 模板)

**Files:**
- Modify: `packages/server/docker/templates/node+java/Dockerfile`

- [ ] **Step 1: 改造 node+java Dockerfile**

```dockerfile
# packages/server/docker/templates/node+java/Dockerfile
FROM node:20-slim

# 安装基础工具 + JDK
RUN apt-get update && apt-get install -y \
    git \
    curl \
    openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 -s /bin/bash codelink

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 预置 Claude Code 配置目录
RUN mkdir -p /home/codelink/.claude && \
    chown -R codelink:codelink /home/codelink/.claude

# 内置 settings.json（bypass 权限白名单）
COPY claude-settings.json /home/codelink/.claude/settings.json
RUN chown codelink:codelink /home/codelink/.claude/settings.json

# 内置 ~/.claude.json（跳过 onboarding）
COPY claude.json /home/codelink/.claude.json
RUN chown codelink:codelink /home/codelink/.claude.json

# 创建工作目录并授权
WORKDIR /workspace
RUN chown -R codelink:codelink /workspace

# 切换到非 root 用户
USER codelink

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/docker/templates/node+java/Dockerfile
git commit -m "feat: create non-root codelink user in node+java template"
```

---

## Task 7: Dockerfile 改造 (node+python 模板)

**Files:**
- Modify: `packages/server/docker/templates/node+python/Dockerfile`

- [ ] **Step 1: 改造 node+python Dockerfile**

```dockerfile
# packages/server/docker/templates/node+python/Dockerfile
FROM node:20-slim

# 安装基础工具 + Python
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 -s /bin/bash codelink

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 预置 Claude Code 配置目录
RUN mkdir -p /home/codelink/.claude && \
    chown -R codelink:codelink /home/codelink/.claude

# 内置 settings.json（bypass 权限白名单）
COPY claude-settings.json /home/codelink/.claude/settings.json
RUN chown codelink:codelink /home/codelink/.claude/settings.json

# 内置 ~/.claude.json（跳过 onboarding）
COPY claude.json /home/codelink/.claude.json
RUN chown codelink:codelink /home/codelink/.claude.json

# 创建工作目录并授权
WORKDIR /workspace
RUN chown -R codelink:codelink /workspace

# 切换到非 root 用户
USER codelink

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/docker/templates/node+python/Dockerfile
git commit -m "feat: create non-root codelink user in node+python template"
```

---

## Task 8: docker-exec 改造支持用户配置注入

**Files:**
- Modify: `packages/server/src/terminal/docker-exec.ts`

- [ ] **Step 1: 新增 execWithUserEnv 函数**

在 `packages/server/src/terminal/docker-exec.ts` 中添加：

```typescript
// packages/server/src/terminal/docker-exec.ts
// 在文件末尾添加：

/**
 * 带用户环境变量的 exec 创建
 * @param containerId 容器 ID
 * @param cmd 命令
 * @param interactive 是否交互模式
 * @param userEnv 用户环境变量对象
 * @returns exec session
 */
export async function execWithUserEnv(
  containerId: string,
  cmd: string[],
  interactive: boolean = false,
  userEnv: Record<string, string> = {}
): Promise<ExecSession> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

  // 合并基础环境变量和用户环境变量
  const env = [
    'TERM=xterm-256color',
    ...Object.entries(userEnv)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`),
  ];

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: interactive,
    AttachStdout: true,
    AttachStderr: true,
    Tty: interactive,
    Env: env,
    User: 'codelink',
  });

  const stream = await exec.start({
    Detach: false,
    Tty: interactive,
    stdin: interactive,
    hijack: interactive,
  });

  return { exec, execId: exec.id, stream };
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/terminal/docker-exec.ts
git commit -m "feat: add execWithUserEnv for injecting user environment variables"
```

---

## Task 9: terminal-manager 改造支持用户配置

**Files:**
- Modify: `packages/server/src/terminal/terminal-manager.ts`

- [ ] **Step 1: 修改 createSession 接口**

修改 `packages/server/src/terminal/terminal-manager.ts`：

```typescript
// packages/server/src/terminal/terminal-manager.ts
// 修改导入：
import {
  streamExecOutput,
  resizeExecTTY,
  writeToExecStream,
  closeExecStdin,
  execWithUserEnv,
  type ExecSession,
} from './docker-exec.js';

// 修改 createSession 方法签名：
async createSession(
  containerId: string,
  ws: WebSocket,
  cols: number = 80,
  rows: number = 24,
  userEnv?: Record<string, string>
): Promise<string> {
  const sessionId = `term-${++this.sessionCounter}-${Date.now()}`;

  try {
    // 使用带用户环境变量的 exec
    const execSession = userEnv
      ? await execWithUserEnv(containerId, ['/bin/sh', '-c', 'exec bash || exec sh'], true, userEnv)
      : await streamExecOutput(containerId, ['/bin/sh', '-c', 'exec bash || exec sh'], true, { env: ['TERM=xterm-256color'] });

    // ... 后续代码不变
  }
}
```

完整修改后的 `createSession` 方法：

```typescript
async createSession(
  containerId: string,
  ws: WebSocket,
  cols: number = 80,
  rows: number = 24,
  userEnv?: Record<string, string>
): Promise<string> {
  const sessionId = `term-${++this.sessionCounter}-${Date.now()}`;

  try {
    // 启动交互式 shell，优先使用 bash，回退到 sh
    const execSession = userEnv
      ? await execWithUserEnv(containerId, ['/bin/sh', '-c', 'exec bash || exec sh'], true, userEnv)
      : await streamExecOutput(containerId, ['/bin/sh', '-c', 'exec bash || exec sh'], true, { env: ['TERM=xterm-256color'] });

    const session: TerminalSession = {
      id: sessionId,
      containerId,
      ws,
      execSession,
      cols,
      rows,
      createdAt: new Date(),
    };

    // 监听容器输出
    execSession.stream.on('data', (data: Buffer) => {
      this.sendToWebSocket(ws, {
        type: 'output',
        data: data.toString('base64'),
      });
    });

    // 监听 stream 错误
    execSession.stream.on('error', (error: Error) => {
      logger.error(`Terminal session ${sessionId} stream error`, error);
      this.sendToWebSocket(ws, {
        type: 'error',
        message: error.message,
      });
    });

    // 监听 stream 结束
    execSession.stream.on('end', () => {
      this.sendToWebSocket(ws, { type: 'exit' });
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    return sessionId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create terminal session';
    this.sendToWebSocket(ws, {
      type: 'error',
      message,
    });
    throw error;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/terminal/terminal-manager.ts
git commit -m "feat: support user environment variables in terminal session"
```

---

## Task 10: terminal route 改造 - 查询用户配置

**Files:**
- Modify: `packages/server/src/routes/terminal.ts`

- [ ] **Step 1: 导入加密模块**

```typescript
// packages/server/src/routes/terminal.ts
// 在导入区域添加：
import { decrypt, isEncryptionKeySet } from '../crypto/aes.js';
```

- [ ] **Step 2: 修改 handleStart 函数**

修改 `handleStart` 函数，在创建终端会话前查询用户配置：

```typescript
// packages/server/src/routes/terminal.ts
// 修改 handleStart 函数：

async function handleStart(msg: TerminalStartMessage): Promise<void> {
  const access = checkProjectAccess();
  if (!access.hasAccess || !access.project) {
    sendMessage({ type: 'error', message: '项目不存在或无权访问' });
    return;
  }

  const project = access.project;

  // 检查项目是否有容器
  if (!project.container_id) {
    sendMessage({ type: 'error', message: '项目没有关联的容器，请先启动容器' });
    return;
  }

  // 检查容器状态
  try {
    const status = await getContainerStatus(project.container_id);
    if (status !== 'running') {
      sendMessage({ type: 'error', message: '容器未运行，请先启动容器' });
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取容器状态失败';
    sendMessage({ type: 'error', message });
    return;
  }

  // 查询用户 Claude 配置
  const configRow = db
    .prepare('SELECT config FROM user_claude_configs WHERE user_id = ?')
    .get(userId) as { config: string } | undefined;

  if (!configRow) {
    sendMessage({ type: 'error', message: '请先在「设置 → Claude Code 配置」中完成配置后再使用终端' });
    return;
  }

  // 解密配置并提取环境变量
  let userEnv: Record<string, string> = {};
  try {
    if (!isEncryptionKeySet()) {
      sendMessage({ type: 'error', message: '服务器加密密钥未配置，请联系管理员' });
      return;
    }

    const config = JSON.parse(decrypt(configRow.config));
    if (config.env && typeof config.env === 'object') {
      userEnv = config.env;
    }

    // 验证 auth_token 是否存在
    if (!userEnv.ANTHROPIC_AUTH_TOKEN) {
      sendMessage({ type: 'error', message: 'ANTHROPIC_AUTH_TOKEN 未配置，请完善配置后再使用终端' });
      return;
    }
  } catch (error) {
    logger.error('Failed to decrypt user config', error);
    sendMessage({ type: 'error', message: '用户配置解密失败，请重新配置' });
    return;
  }

  // 创建终端会话
  try {
    const sessionId = await terminalManager.createSession(
      project.container_id,
      ws,
      msg.cols || 80,
      msg.rows || 24,
      userEnv
    );
    currentSessionId = sessionId;
    sendMessage({ type: 'started', sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建终端会话失败';
    sendMessage({ type: 'error', message });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/routes/terminal.ts
git commit -m "feat: check user Claude config before creating terminal session"
```

---

## Task 11: 前端 Claude 配置页面

**Files:**
- Create: `packages/web/src/app/settings/page.tsx`

- [ ] **Step 1: 创建设置页面**

```typescript
// packages/web/src/app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_CONFIG = {
  env: {
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  },
  skipDangerousModePermissionPrompt: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<string>(JSON.stringify(DEFAULT_CONFIG, null, 2));
  const [hasConfig, setHasConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/claude-config', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('获取配置失败');
      }

      const data = await res.json();
      if (data.hasConfig) {
        setConfig(JSON.stringify(data.config, null, 2));
        setHasConfig(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // 验证 JSON 格式
      const parsedConfig = JSON.parse(config);

      const res = await fetch('/api/claude-config', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: parsedConfig }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存失败');
      }

      setHasConfig(true);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON 格式错误');
      } else {
        setError(err instanceof Error ? err.message : '保存失败');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Claude Code 配置</h1>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">配置 JSON</label>
            <textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="w-full h-64 bg-gray-700 text-gray-100 rounded-lg p-4 font-mono text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>

            {hasConfig && (
              <button
                onClick={() => setConfig(JSON.stringify(DEFAULT_CONFIG, null, 2))}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                重置为默认
              </button>
            )}
          </div>

          <div className="mt-6 text-gray-400 text-sm">
            <p>提示：ANTHROPIC_AUTH_TOKEN 为必填项。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加导航链接到侧边栏**

修改 `packages/web/src/components/sidebar/user-section.tsx`，添加设置链接：

```typescript
// packages/web/src/components/sidebar/user-section.tsx
// 在用户菜单中添加设置链接：

<Link
  href="/settings"
  className="block px-4 py-2 text-gray-300 hover:bg-gray-700"
>
  Claude Code 配置
</Link>
```

- [ ] **Step 3: 提交**

```bash
git add packages/web/src/app/settings/page.tsx packages/web/src/components/sidebar/user-section.tsx
git commit -m "feat: add Claude Code config settings page"
```

---

## Task 12: 终端面板未配置提示

**Files:**
- Modify: `packages/web/src/components/terminal/terminal-panel.tsx`

- [ ] **Step 1: 添加未配置状态处理**

修改 `packages/web/src/components/terminal/terminal-panel.tsx`：

```typescript
// packages/web/src/components/terminal/terminal-panel.tsx
// 在 WebSocket 错误处理中添加：

// 当收到 error 消息且内容包含"请先配置"时显示提示
if (msg.type === 'error' && msg.message.includes('请先在「设置')) {
  setShowConfigPrompt(true);
  setErrorMessage(msg.message);
}
```

添加配置提示 UI：

```typescript
// 在组件中添加状态：
const [showConfigPrompt, setShowConfigPrompt] = useState(false);

// 在渲染中添加提示 UI：
{showConfigPrompt && (
  <div className="flex items-center justify-center h-full bg-gray-900">
    <div className="text-center">
      <p className="text-gray-300 mb-4">{errorMessage}</p>
      <Link
        href="/settings"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        前往设置
      </Link>
    </div>
  </div>
)}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/terminal/terminal-panel.tsx
git commit -m "feat: show config prompt when user has not configured Claude settings"
```

---

## Task 13: 重新构建镜像并测试

**Files:**
- 无新文件

- [ ] **Step 1: 删除旧镜像**

```bash
docker rmi code-link-node:latest code-link-node-java:latest code-link-node-python:latest 2>/dev/null || true
```

- [ ] **Step 2: 重新构建镜像**

```bash
cd packages/server
pnpm dev  # 启动服务器，自动构建镜像
```

- [ ] **Step 3: 验证镜像包含 codelink 用户**

```bash
docker run --rm code-link-node:latest id
```
Expected: `uid=1000(codelink) gid=1000(codelink)`

- [ ] **Step 4: 验证 Claude 配置文件**

```bash
docker run --rm code-link-node:latest cat /home/codelink/.claude/settings.json
docker run --rm code-link-node:latest cat /home/codelink/.claude.json
```
Expected: 显示正确的 JSON 内容

- [ ] **Step 5: 提交**

```bash
git commit --allow-empty -m "test: verify Docker images rebuilt with codelink user"
```

---

## Task 14: 集成测试

**Files:**
- Test: `packages/server/tests/claude-config.test.ts`
- Test: `packages/server/tests/terminal-with-config.test.ts`

- [ ] **Step 1: 写 Claude 配置 API 测试**

```typescript
// packages/server/tests/claude-config.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createClaudeConfigRouter } from '../src/routes/claude-config.js';
import { setEncryptionKey } from '../src/crypto/aes.js';
import { initSchema } from '../src/db/schema.js';
import express from 'express';
import request from 'supertest';

describe('Claude Config API', () => {
  const testKey = 'test-encryption-key-32-bytes!!';
  let app: express.Application;
  let db: Database.Database;

  beforeAll(() => {
    setEncryptionKey(testKey);
    db = new Database(':memory:');
    initSchema(db);

    // 创建测试用户
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('test', 'test@test.com', 'hash');

    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, res, next) => {
      (req as any).userId = 1;
      next();
    });

    app.use('/api/claude-config', createClaudeConfigRouter(db));
  });

  afterAll(() => {
    db.close();
  });

  it('should return default config when not configured', async () => {
    const res = await request(app).get('/api/claude-config');
    expect(res.status).toBe(200);
    expect(res.body.hasConfig).toBe(false);
    expect(res.body.config.env).toBeDefined();
  });

  it('should save and retrieve config', async () => {
    const config = {
      env: {
        ANTHROPIC_BASE_URL: 'https://test.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-test',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5',
      },
      skipDangerousModePermissionPrompt: true,
    };

    const saveRes = await request(app)
      .post('/api/claude-config')
      .send({ config });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);

    const getRes = await request(app).get('/api/claude-config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.hasConfig).toBe(true);
    expect(getRes.body.config.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test');
  });

  it('should reject empty auth_token', async () => {
    const res = await request(app)
      .post('/api/claude-config')
      .send({
        config: {
          env: { ANTHROPIC_AUTH_TOKEN: '' },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ANTHROPIC_AUTH_TOKEN');
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
cd packages/server && pnpm test tests/claude-config.test.ts
```
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/server/tests/claude-config.test.ts
git commit -m "test: add Claude config API tests"
```

---

## Spec Coverage Check

| Spec 要求 | Task |
|-----------|------|
| Dockerfile 创建 codelink 用户 | Task 5, 6, 7 |
| 内置 settings.json 权限白名单 | Task 4, 5 |
| 内置 ~/.claude.json 跳过 onboarding | Task 4, 5 |
| 数据库表 user_claude_configs | Task 2 |
| AES-256-GCM 加密存储 | Task 1 |
| Claude 配置 CRUD API | Task 3 |
| 运行时环境变量注入 | Task 8, 9, 10 |
| 前端配置页面 | Task 11 |
| 未配置时显示提示 | Task 12 |
| 必须先配置才能用终端 | Task 10 |

所有 spec 要求已覆盖。