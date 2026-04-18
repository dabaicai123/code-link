---
name: claude-code-auth
description: Claude Code 容器鉴权与用户配置管理方案
created: 2026-04-18
status: draft
---

# Claude Code 容器鉴权设计文档

## 概述

为项目容器实现安全的 Claude Code CLI 鉴权机制：
- 容器以非 root 用户 `codelink` 运行
- 用户配置运行时注入，不落盘存储
- 镜像内置 bypass 权限白名单

## 核心设计决策

| 决策项 | 选择 |
|--------|------|
| 用户隔离级别 | 项目级隔离，共享 `codelink` 用户 |
| API Key 管理方式 | 运行时环境变量注入，不落盘 |
| 权限配置方式 | Dockerfile 内置 settings.json |
| 非 root 用户方式 | 固定用户名 `codelink` (UID 1000) |
| 新用户处理 | 必须先配置才能使用终端 |

## 一、镜像改造

### 1.1 Dockerfile 修改

以 `packages/server/docker/templates/node/Dockerfile` 为例：

```dockerfile
FROM node:20-slim

# 安装基础工具
RUN apt-get update && apt-get install -y \
    git curl \
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

# 创建工作目录并授权
WORKDIR /workspace
RUN chown -R codelink:codelink /workspace

# 切换到非 root 用户
USER codelink

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

### 1.2 权限白名单配置

**文件：** `packages/server/docker/templates/claude-settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(pnpm *)",
      "Bash(node *)",
      "Bash(git *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(mkdir *)",
      "Bash(rm *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Read",
      "Write",
      "Edit"
    ],
    "deny": []
  }
}
```

## 二、用户配置存储

### 2.1 数据库表

**新增表：** `user_claude_configs`

```sql
CREATE TABLE user_claude_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);
```

### 2.2 配置 JSON 结构

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://llm-risk-coding.61info.cn",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "kimi-k2.5",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1"
  },
  "skipDangerousModePermissionPrompt": true
}
```

### 2.3 加密策略

- `config` 字段整体使用 AES-256-GCM 加密存储
- 加密密钥从环境变量 `CLAUDE_CONFIG_ENCRYPTION_KEY` 获取
- 服务器启动时检查密钥是否存在，缺失则警告

## 三、运行时注入机制

### 3.1 终端连接流程

```
用户登录 → 前端获取 JWT
    ↓
用户打开终端 → WebSocket 连接请求
    ↓
后端验证用户 → 查询 user_claude_configs
    ↓
无配置？ → 返回错误，提示先配置
有配置？ → 解密 config
    ↓
提取 env 字段 → 构建环境变量数组
    ↓
容器 exec → 注入环境变量，指定 User: codelink
    ↓
建立 WebSocket 桥接 → 用户使用 claude 命令
```

### 3.2 代码示例

```typescript
async function createTerminalSession(
  containerId: string,
  userId: number
): Promise<Docker.Exec> {
  // 1. 查询用户配置
  const row = db.prepare(`
    SELECT config FROM user_claude_configs WHERE user_id = ?
  `).get(userId);
  
  if (!row) {
    throw new Error('USER_CONFIG_REQUIRED');
  }
  
  // 2. 解密配置
  const config = JSON.parse(decrypt(row.config));
  
  // 3. 构建环境变量
  const envVars = Object.entries(config.env)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key}=${value}`);
  
  // 4. 创建 exec
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  
  const exec = await container.exec({
    Cmd: ['/bin/bash'],
    Env: envVars,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    User: 'codelink',
  });
  
  return exec;
}
```

## 四、前端配置界面

### 4.1 用户设置页面

新增「Claude Code 配置」区块：

- JSON 编辑器（textarea 或 Monaco Editor）
- 显示完整配置结构
- 保存按钮
- 验证 JSON 格式

### 4.2 默认渲染模板

新用户首次打开配置页面时显示：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "",
    "ANTHROPIC_AUTH_TOKEN": "",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1"
  },
  "skipDangerousModePermissionPrompt": true
}
```

### 4.3 未配置提示

用户尝试打开终端但未配置时，显示提示：

> 请先在「设置 → Claude Code 配置」中完成配置后再使用终端。

## 五、多用户协作场景

### 5.1 同一项目多人连接

- 每个终端会话独立 exec 进程
- 各自注入自己的环境变量
- 文件操作共享（同一 `codelink` 用户）
- 各自 Claude Code 会话使用各自的 auth_token 计费

### 5.2 冲突处理

- 文件编辑：后写入覆盖
- 建议通过项目聊天协调工作

## 六、安全考量

| 风险 | 缓解措施 |
|------|----------|
| Auth token 泄露 | 加密存储，不落盘到容器 |
| 容器提权 | 非 root 用户运行 |
| 权限滥用 | 内置 bypass 白名单限制 |
| 日志泄露敏感信息 | Logger 模块过滤敏感字段 |

## 七、需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `packages/server/src/db/schema.ts` | 新增 user_claude_configs 表 |
| `packages/server/src/docker/templates.ts` | 支持非 root 用户容器创建 |
| `packages/server/docker/templates/*/Dockerfile` | 创建 codelink 用户，内置配置 |
| `packages/server/docker/templates/claude-settings.json` | 新增权限白名单文件 |
| `packages/server/src/terminal/docker-exec.ts` | 注入用户环境变量 |
| `packages/server/src/routes/auth.ts` | 新增用户配置 CRUD 接口 |
| `packages/web/src/app/settings/page.tsx` | 新增 Claude Code 配置界面 |
| `packages/web/src/components/terminal/*.tsx` | 未配置时显示提示 |
