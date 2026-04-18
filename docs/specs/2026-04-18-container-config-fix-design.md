---
name: 容器配置修复设计
description: 修复镜像构建时配置文件丢失问题，并添加容器启动前的配置校验
type: project
---

# 容器配置修复设计

## 背景

当前存在两个问题：

1. **镜像构建时配置文件丢失**：`claude.json` 和 `claude-settings.json` 在 `templates/` 父目录，但构建上下文只包含子目录（如 `node/`），导致 Dockerfile 中的 `COPY` 命令找不到这些文件

2. **容器启动缺少配置校验**：用户可以在未配置 Claude Code JSON 的情况下启动容器，直到打开终端时才发现配置缺失，体验不佳

## 解决方案

### 1. 修复镜像构建路径问题

**修改 `ensureTemplateImage` 函数**（`packages/server/src/docker/templates.ts`）

将构建上下文从子目录改为 `templates/` 父目录，同时指定 Dockerfile 路径：

```typescript
const stream = await docker.buildImage(
  {
    context: path.join(process.cwd(), 'docker/templates'),
    src: [
      'claude.json',
      'claude-settings.json',
      `${type}/Dockerfile`,
      `${type}/entrypoint.sh`
    ]
  },
  { t: config.imageName, dockerfile: `${type}/Dockerfile` }
);
```

**修改 Dockerfile**（三个模板：`node/`, `node+java/`, `node+python/`）

调整 `entrypoint.sh` 的复制路径：

```dockerfile
COPY entrypoint.sh /entrypoint.sh
# 改为（根据模板类型）
COPY node/entrypoint.sh /entrypoint.sh
# 或 node+java/entrypoint.sh, node+python/entrypoint.sh
```

`claude.json` 和 `claude-settings.json` 的 COPY 路径保持不变，因为它们现在在构建上下文根目录。

### 2. 容器启动前配置校验

**后端修改**（`packages/server/src/routes/containers.ts`）

在 `/api/projects/:id/container/start` 路由中添加校验：

```typescript
// 在启动容器前检查用户是否配置了 Claude Code
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
```

**前端修改**（`packages/web/src/app/dashboard/page.tsx`）

在 `handleProjectSelect` 和 `handleRestart` 函数中处理 `CLAUDE_CONFIG_MISSING` 错误：

```typescript
try {
  await api.post(`/projects/${project.id}/container/start`);
  // ...
} catch (err: any) {
  if (err?.response?.data?.code === 'CLAUDE_CONFIG_MISSING') {
    // 显示配置引导提示
    alert(err.response.data.error);
    router.push('/settings');
  } else {
    console.error('启动容器失败:', err);
  }
}
```

## 影响范围

- `packages/server/src/docker/templates.ts` - 修改构建逻辑
- `packages/server/docker/templates/node/Dockerfile` - 修改 COPY 路径
- `packages/server/docker/templates/node+java/Dockerfile` - 修改 COPY 路径
- `packages/server/docker/templates/node+python/Dockerfile` - 修改 COPY 路径
- `packages/server/src/routes/containers.ts` - 添加配置校验
- `packages/web/src/app/dashboard/page.tsx` - 处理错误响应

## 测试计划

1. 删除现有镜像，重新构建验证配置文件是否正确复制
2. 未配置用户启动容器，验证是否返回正确错误
3. 已配置用户启动容器，验证流程正常