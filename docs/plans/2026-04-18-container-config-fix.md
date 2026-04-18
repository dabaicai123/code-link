# 容器配置修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复镜像构建时配置文件丢失问题，并添加容器启动前的 Claude Code 配置校验

**Architecture:** 修改 Docker 构建上下文路径以正确包含配置文件；在容器启动 API 添加配置校验逻辑；前端处理配置缺失错误响应

**Tech Stack:** TypeScript, Docker/dockerode, Express, React/Next.js, Vitest

---

## 文件结构

| 文件 | 责任 |
|------|------|
| `packages/server/src/docker/templates.ts` | 修改构建上下文，指定 Dockerfile 路径 |
| `packages/server/docker/templates/node/Dockerfile` | 修改 entrypoint.sh COPY 路径 |
| `packages/server/docker/templates/node+java/Dockerfile` | 修改 entrypoint.sh COPY 路径 |
| `packages/server/docker/templates/node+python/Dockerfile` | 修改 entrypoint.sh COPY 路径 |
| `packages/server/src/routes/containers.ts` | 添加 Claude Code 配置校验 |
| `packages/server/tests/templates.test.ts` | 添加构建上下文路径测试 |
| `packages/server/tests/containers.test.ts` | 添加配置缺失校验测试 |
| `packages/web/src/app/dashboard/page.tsx` | 处理 CLAUDE_CONFIG_MISSING 错误 |

---

### Task 1: 修复 templates.ts 构建上下文

**Files:**
- Modify: `packages/server/src/docker/templates.ts:47-58`
- Test: `packages/server/tests/templates.test.ts`

- [ ] **Step 1: 写入失败的测试**

在 `packages/server/tests/templates.test.ts` 中添加测试验证构建上下文路径：

```typescript
import path from 'path';
import fs from 'fs';

describe('ensureTemplateImage build context', () => {
  it('should use parent templates directory as context', () => {
    const config = getTemplateConfig('node');
    // 验证 dockerfileDir 指向子目录，但构建上下文应该是父目录
    const expectedContext = path.dirname(config.dockerfileDir);
    expect(expectedContext).toMatch(/templates$/);
  });

  it('should include claude.json in build context src', () => {
    // 验证配置文件在 templates 目录
    const templatesDir = path.dirname(getTemplateConfig('node').dockerfileDir);
    const claudeJsonPath = path.join(templatesDir, 'claude.json');
    const claudeSettingsPath = path.join(templatesDir, 'claude-settings.json');
    // 文件应存在
    expect(fs.existsSync(claudeJsonPath)).toBe(true);
    expect(fs.existsSync(claudeSettingsPath)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/server && pnpm test tests/templates.test.ts -v`
Expected: 新测试应通过（验证现有文件结构）

- [ ] **Step 3: 修改 templates.ts 构建逻辑**

修改 `packages/server/src/docker/templates.ts` 的 `ensureTemplateImage` 函数：

```typescript
export async function ensureTemplateImage(type: TemplateType): Promise<void> {
  const docker = getDockerClient();
  const config = getTemplateConfig(type);

  // 检查镜像是否已存在
  const images = await docker.listImages({ filters: `{"dangling":["false"],"reference":["${config.imageName}"]}` });
  if (images.length > 0) return;

  // 构建上下文使用 templates 父目录
  const templatesDir = path.dirname(config.dockerfileDir);

  // 构建镜像
  const stream = await docker.buildImage(
    {
      context: templatesDir,
      src: [
        'claude.json',
        'claude-settings.json',
        `${type}/Dockerfile`,
        `${type}/entrypoint.sh`
      ]
    },
    { t: config.imageName, dockerfile: `${type}/Dockerfile` }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/server && pnpm test tests/templates.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/docker/templates.ts packages/server/tests/templates.test.ts
git commit -m "fix(server): use templates parent dir as docker build context"
```

---

### Task 2: 修改 node Dockerfile COPY 路径

**Files:**
- Modify: `packages/server/docker/templates/node/Dockerfile:34`

- [ ] **Step 1: 修改 node/Dockerfile**

修改 `packages/server/docker/templates/node/Dockerfile`：

```dockerfile
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

# 修改路径：从 templates/node/ 目录复制
COPY node/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/docker/templates/node/Dockerfile
git commit -m "fix(docker): update entrypoint copy path for node template"
```

---

### Task 3: 修改 node+java Dockerfile COPY 路径

**Files:**
- Modify: `packages/server/docker/templates/node+java/Dockerfile`

- [ ] **Step 1: 查看 node+java/Dockerfile 当前内容**

先读取现有文件确认需要修改的行。

- [ ] **Step 2: 修改 node+java/Dockerfile**

修改最后一行 COPY 语句：

```dockerfile
# 将 COPY entrypoint.sh /entrypoint.sh 改为：
COPY node+java/entrypoint.sh /entrypoint.sh
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/docker/templates/node+java/Dockerfile
git commit -m "fix(docker): update entrypoint copy path for node+java template"
```

---

### Task 4: 修改 node+python Dockerfile COPY 路径

**Files:**
- Modify: `packages/server/docker/templates/node+python/Dockerfile`

- [ ] **Step 1: 查看 node+python/Dockerfile 当前内容**

先读取现有文件确认需要修改的行。

- [ ] **Step 2: 修改 node+python/Dockerfile**

修改最后一行 COPY 语句：

```dockerfile
# 将 COPY entrypoint.sh /entrypoint.sh 改为：
COPY node+python/entrypoint.sh /entrypoint.sh
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/docker/templates/node+python/Dockerfile
git commit -m "fix(docker): update entrypoint copy path for node+python template"
```

---

### Task 5: 后端添加容器启动配置校验

**Files:**
- Modify: `packages/server/src/routes/containers.ts:61-74`
- Test: `packages/server/tests/containers.test.ts`

- [ ] **Step 1: 写入失败的测试**

在 `packages/server/tests/containers.test.ts` 的 `POST /api/projects/:id/container/start` describe 块中添加测试：

```typescript
it('用户未配置 Claude Code 应返回 400', async () => {
  // 用户已登录但未配置 Claude Code
  const res = await request(app)
    .post(`/api/projects/${projectId}/container/start`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('CLAUDE_CONFIG_MISSING');
  expect(res.body.error).toContain('请先在「设置');
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/server && pnpm test tests/containers.test.ts -v`
Expected: FAIL - 测试期望 400，但当前返回 200

- [ ] **Step 3: 修改 containers.ts 添加校验**

修改 `packages/server/src/routes/containers.ts`，在 `try` 块开头添加配置校验：

```typescript
// 在 try 块开头添加（大约 line 61 之后）
try {
  // 检查用户是否配置了 Claude Code
  const configRow = db
    .prepare('SELECT config FROM user_claude_configs WHERE user_id = ?')
    .get(userId) as { config: string } | undefined;

  if (!configRow) {
    res.status(400).json({
      error: '请先在「设置 → Claude Code 配置」中完成配置后再启动容器',
      code: 'CLAUDE_CONFIG_MISSING'
    });
    return;
  }

  let containerId = project.container_id;
  // ... 后续代码保持不变
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/server && pnpm test tests/containers.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/routes/containers.ts packages/server/tests/containers.test.ts
git commit -m "feat(server): add Claude Code config validation before container start"
```

---

### Task 6: 前端处理配置缺失错误

**Files:**
- Modify: `packages/web/src/app/dashboard/page.tsx:32-79`

- [ ] **Step 1: 修改 handleProjectSelect 函数**

修改 `packages/web/src/app/dashboard/page.tsx` 的 `handleProjectSelect` 函数：

```typescript
// 选择项目时，自动启动容器
const handleProjectSelect = useCallback(async (project: Project) => {
  // 如果容器未运行，先启动容器，再设置 activeProject
  if (project.status !== 'running') {
    setIsStarting(true);
    try {
      await api.post(`/projects/${project.id}/container/start`);
      // 容器启动成功后再设置 activeProject
      setActiveProject({ ...project, status: 'running' });
      setProjectRefreshKey(k => k + 1);
    } catch (err: any) {
      if (err?.response?.data?.code === 'CLAUDE_CONFIG_MISSING') {
        alert(err.response.data.error);
        router.push('/settings');
      } else {
        console.error('启动容器失败:', err);
      }
    } finally {
      setIsStarting(false);
    }
  } else {
    // 容器已运行，直接设置
    setActiveProject(project);
  }
}, [router]);
```

- [ ] **Step 2: 修改 handleRestart 函数**

修改 `handleRestart` 函数：

```typescript
// 重启容器
const handleRestart = useCallback(async () => {
  if (!activeProject) return;

  setIsStarting(true);
  // 先清除 activeProject，避免 WebSocket 重连
  setActiveProject(null);

  try {
    // 如果容器正在运行，先停止
    if (activeProject.status === 'running') {
      try {
        await api.post(`/projects/${activeProject.id}/container/stop`);
      } catch (err) {
        // 忽略停止错误（容器可能已经停止）
      }
    }
    // 启动容器
    await api.post(`/projects/${activeProject.id}/container/start`);
    setActiveProject({ ...activeProject, status: 'running' });
    setProjectRefreshKey(k => k + 1);
  } catch (err: any) {
    if (err?.response?.data?.code === 'CLAUDE_CONFIG_MISSING') {
      alert(err.response.data.error);
      router.push('/settings');
    } else {
      console.error('重启容器失败:', err);
      // 恢复原状态
      setActiveProject(activeProject);
    }
  } finally {
    setIsStarting(false);
  }
}, [activeProject, router]);
```

- [ ] **Step 3: 提交**

```bash
git add packages/web/src/app/dashboard/page.tsx
git commit -m "feat(web): handle CLAUDE_CONFIG_MISSING error on container start"
```

---

### Task 7: 手动验证镜像构建

**Files:**
- 无文件修改，仅手动验证

- [ ] **Step 1: 删除现有镜像**

Run: `docker rmi code-link-node:latest code-link-node-java:latest code-link-node-python:latest 2>/dev/null || true`

- [ ] **Step 2: 重启服务触发镜像构建**

Run: `cd packages/server && pnpm dev`

- [ ] **Step 3: 验证配置文件存在于镜像中**

Run: `docker run --rm code-link-node:latest cat /home/codelink/.claude.json`

Expected: 输出 `{"hasCompletedOnboarding": true}`

Run: `docker run --rm code-link-node:latest cat /home/codelink/.claude/settings.json`

Expected: 输出包含 permissions 配置

---

## Self-Review 检查清单

1. **Spec coverage:**
   - 镜像构建路径修复 → Task 1-4 ✓
   - 容器启动配置校验 → Task 5 ✓
   - 前端错误处理 → Task 6 ✓
   - 手动验证 → Task 7 ✓

2. **Placeholder scan:** 无 TBD/TODO，所有代码完整

3. **Type consistency:**
   - `CLAUDE_CONFIG_MISSING` 错误码在前后端一致
   - `configRow` 类型定义一致