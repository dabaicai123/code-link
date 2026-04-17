# Docker 容器管理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现项目容器的完整生命周期管理 — 从模板镜像启动容器、运行时状态管理、到销毁清理，为 Web 终端和构建预览提供容器基座。

**Architecture:** 使用 Dockerode (Node.js Docker API 客户端) 管理容器。每个项目对应一个容器，容器名称与项目 ID 关联。模板镜像预先构建好，包含开发环境 + Claude Code CLI + 文件监听 agent。容器挂载持久化卷存储代码，预览时从卷读取 Dockerfile 构建新镜像。

**Tech Stack:** dockerode, Docker API, 持久化卷 (bind mount 或 named volume)

---

## 文件结构

```
packages/server/
├── src/
│   ├── docker/
│   │   ├── client.ts              # Docker 客户端单例
│   │   ├── templates.ts           # 模板镜像定义
│   │   ├── container-manager.ts   # 容器生命周期管理
│   │   └── volume-manager.ts      # 持久化卷管理
│   │── routes/
│   │   └── containers.ts          # 容器操作 API 路由
│   ├── types.ts                   # 添加 ContainerInfo 类型
│   └── index.ts                   # 挂载容器路由
├── docker/
│   ├── templates/
│   │   ├── node/
│   │   │   ├── Dockerfile         # Node.js 模板镜像
│   │   │   └── entrypoint.sh      # 容器启动脚本
│   │   ├── node+java/
│   │   │   ├── Dockerfile
│   │   │   └── entrypoint.sh
│   │   └── node+python/
│   │   │   ├── Dockerfile
│   │   │   └: entrypoint.sh
│   └── agent/
│       ├── file-watcher.ts        # 文件变更监听 agent
│       └── ws-client.ts           # WebSocket client 连接核心服务
├── tests/
│   ├── docker-client.test.ts      # Docker 客户端测试
│   ├── container-manager.test.ts  # 容器管理测试
│   └── containers.test.ts         # API 路由测试
```

---

### Task 1: Docker 客户端单例

**Files:**
- Create: `packages/server/src/docker/client.ts`
- Create: `packages/server/tests/docker-client.test.ts`

- [ ] **Step 1: 添加 dockerode 依赖**

```bash
cd packages/server && pnpm add dockerode && pnpm add -D @types/dockerode
```

- [ ] **Step 2: 写 Docker 客户端单例测试**

```typescript
// tests/docker-client.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getDockerClient } from '../src/docker/client.ts';

describe('Docker Client', () => {
  it('should return a valid Docker instance', () => {
    const docker = getDockerClient();
    expect(docker).toBeDefined();
    expect(docker.version).toBeDefined();
  });

  it('should return the same instance on multiple calls', () => {
    const docker1 = getDockerClient();
    const docker2 = getDockerClient();
    expect(docker1).toBe(docker2);
  });
});
```

- [ ] **Step 3: 实现 Docker 客户端单例**

```typescript
// src/docker/client.ts
import Docker from 'dockerode';

let dockerInstance: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerInstance) {
    dockerInstance = new Docker();
  }
  return dockerInstance;
}
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && pnpm test tests/docker-client.test.ts
```

Expected: PASS（需要本地 Docker 运行）

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/docker/client.ts packages/server/tests/docker-client.test.ts packages/server/package.json
git commit -m "feat: add Docker client singleton"
```

---

### Task 2: 模板镜像定义

**Files:**
- Create: `packages/server/src/docker/templates.ts`
- Create: `packages/server/docker/templates/node/Dockerfile`
- Create: `packages/server/docker/templates/node/entrypoint.sh`
- Create: `packages/server/docker/templates/node+java/Dockerfile`
- Create: `packages/server/docker/templates/node+java/entrypoint.sh`
- Create: `packages/server/docker/templates/node+python/Dockerfile`
- Create: `packages/server/docker/templates/node+python/entrypoint.sh`

- [ ] **Step 1: 写模板定义测试**

```typescript
// tests/templates.test.ts
import { describe, it, expect } from 'vitest';
import { getTemplateConfig, TEMPLATE_TYPES, isValidTemplate } from '../src/docker/templates.ts';

describe('Template Config', () => {
  it('should have valid template types', () => {
    expect(TEMPLATE_TYPES).toContain('node');
    expect(TEMPLATE_TYPES).toContain('node+java');
    expect(TEMPLATE_TYPES).toContain('node+python');
  });

  it('should return correct config for node template', () => {
    const config = getTemplateConfig('node');
    expect(config.imageName).toBe('code-link-node:latest');
    expect(config.dockerfileDir).toMatch(/templates\/node$/);
  });

  it('should validate template types correctly', () => {
    expect(isValidTemplate('node')).toBe(true);
    expect(isValidTemplate('invalid')).toBe(false);
  });
});
```

- [ ] **Step 2: 实现模板配置**

```typescript
// src/docker/templates.ts
import path from 'path';
import { getDockerClient } from './client.ts';

export const TEMPLATE_TYPES = ['node', 'node+java', 'node+python'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

interface TemplateConfig {
  imageName: string;
  dockerfileDir: string;
  baseImage: string;
}

const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  node: {
    imageName: 'code-link-node:latest',
    dockerfileDir: path.join(process.cwd(), 'docker/templates/node'),
    baseImage: 'node:20-slim',
  },
  'node+java': {
    imageName: 'code-link-node-java:latest',
    dockerfileDir: path.join(process.cwd(), 'docker/templates/node+java'),
    baseImage: 'node:20-slim',
  },
  'node+python': {
    imageName: 'code-link-node-python:latest',
    dockerfileDir: path.join(process.cwd(), 'docker/templates/node+python'),
    baseImage: 'node:20-slim',
  },
};

export function getTemplateConfig(type: TemplateType): TemplateConfig {
  return TEMPLATE_CONFIGS[type];
}

export function isValidTemplate(type: string): type is TemplateType {
  return TEMPLATE_TYPES.includes(type as TemplateType);
}

export async function ensureTemplateImage(type: TemplateType): Promise<void> {
  const docker = getDockerClient();
  const config = getTemplateConfig(type);

  // 检查镜像是否已存在
  const images = await docker.listImages({ filter: config.imageName });
  if (images.length > 0) return;

  // 构建镜像
  const stream = await docker.buildImage(
    { context: config.dockerfileDir, src: ['Dockerfile', 'entrypoint.sh'] },
    { t: config.imageName }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
}
```

- [ ] **Step 3: 创建 Node 模板 Dockerfile**

```dockerfile
# docker/templates/node/Dockerfile
FROM node:20-slim

# 安装基础工具
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 创建工作目录
WORKDIR /workspace

# 复制启动脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 创建 agent 目录
RUN mkdir -p /agent

ENTRYPOINT ["/entrypoint.sh"]
```

```bash
# docker/templates/node/entrypoint.sh
#!/bin/bash
set -e

# 启动文件监听 agent (后续实现)
# node /agent/file-watcher.js &

# 启动 WebSocket client (后续实现)
# node /agent/ws-client.js &

# 保持容器运行
exec tail -f /dev/null
```

- [ ] **Step 4: 创建 Node+Java 模板 Dockerfile**

```dockerfile
# docker/templates/node+java/Dockerfile
FROM node:20-slim

# 安装 JDK 21
RUN apt-get update && apt-get install -y \
    openjdk-21-jdk \
    maven \
    gradle \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 设置 JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /agent

ENTRYPOINT ["/entrypoint.sh"]
```

```bash
# docker/templates/node+java/entrypoint.sh
#!/bin/bash
set -e
exec tail -f /dev/null
```

- [ ] **Step 5: 创建 Node+Python 模板 Dockerfile**

```dockerfile
# docker/templates/node+python/Dockerfile
FROM node:20-slim

# 安装 Python 3.12
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /agent

ENTRYPOINT ["/entrypoint.sh"]
```

```bash
# docker/templates/node+python/entrypoint.sh
#!/bin/bash
set -e
exec tail -f /dev/null
```

- [ ] **Step 6: 运行测试验证**

```bash
cd packages/server && pnpm test tests/templates.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/docker/templates.ts packages/server/docker/templates/
git commit -m "feat: add Docker template definitions and Dockerfiles"
```

---

### Task 3: 容器生命周期管理

**Files:**
- Create: `packages/server/src/docker/container-manager.ts`
- Create: `packages/server/tests/container-manager.test.ts`
- Modify: `packages/server/src/types.ts`

- [ ] **Step 1: 添加 ContainerInfo 类型到 types.ts**

```typescript
// src/types.ts - 添加以下内容
export interface ContainerInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'created';
  projectId: number;
  templateType: TemplateType;
  volumePath: string;
}
```

- [ ] **Step 2: 写容器管理测试**

```typescript
// tests/container-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProjectContainer, startContainer, stopContainer, removeContainer, getContainerStatus } from '../src/docker/container-manager.ts';
import { getDockerClient } from '../src/docker/client.ts';

describe('Container Manager', () => {
  const testProjectId = 9999;
  const testTemplate = 'node';

  afterEach(async () => {
    // 清理测试容器
    const docker = getDockerClient();
    try {
      const container = docker.getContainer(`code-link-project-${testProjectId}`);
      await container.remove({ force: true });
    } catch {}
  });

  it('should create a container for a project', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    expect(containerId).toBeDefined();
    expect(containerId.length).toBeGreaterThan(0);
  });

  it('should start a stopped container', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    await startContainer(containerId);
    const status = await getContainerStatus(containerId);
    expect(status).toBe('running');
  });

  it('should stop a running container', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    await startContainer(containerId);
    await stopContainer(containerId);
    const status = await getContainerStatus(containerId);
    expect(status).toBe('exited');
  });

  it('should remove a container', async () => {
    const containerId = await createProjectContainer(testProjectId, testTemplate, '/tmp/test-volume');
    await removeContainer(containerId);
    const docker = getDockerClient();
    try {
      await docker.getContainer(containerId).inspect();
      expect.fail('Container should be removed');
    } catch (error: any) {
      expect(error.statusCode).toBe(404);
    }
  });
});
```

- [ ] **Step 3: 实现容器管理器**

```typescript
// src/docker/container-manager.ts
import Docker from 'dockerode';
import { getDockerClient } from './client.ts';
import { ensureTemplateImage, getTemplateConfig, TemplateType } from './templates.ts';

const CONTAINER_NAME_PREFIX = 'code-link-project-';

export async function createProjectContainer(
  projectId: number,
  templateType: TemplateType,
  volumePath: string
): Promise<string> {
  const docker = getDockerClient();
  const config = getTemplateConfig(templateType);

  await ensureTemplateImage(templateType);

  const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

  // 检查是否已存在同名容器
  try {
    const existing = await docker.getContainer(containerName).inspect();
    return existing.Id;
  } catch {
    // 不存在，继续创建
  }

  const container = await docker.createContainer({
    name: containerName,
    Image: config.imageName,
    HostConfig: {
      Binds: [`${volumePath}:/workspace`],
    },
    Env: [
      `PROJECT_ID=${projectId}`,
      `TEMPLATE_TYPE=${templateType}`,
    ],
  });

  return container.id;
}

export async function startContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.start();
}

export async function stopContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.stop({ t: 10 });
}

export async async function removeContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.remove({ force: true });
}

export async function getContainerStatus(containerId: string): Promise<string> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  return info.State.Status;
}

export async function getProjectContainer(projectId: number): Promise<Docker.Container | null> {
  const docker = getDockerClient();
  const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

  try {
    return docker.getContainer(containerName);
  } catch {
    return null;
  }
}

export async function execInContainer(
  containerId: string,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ Detach: false });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    stream.on('data', (chunk: Buffer) => {
      // Docker stream 格式: 前8字节是header，之后是内容
      const type = chunk[0];
      const content = chunk.slice(8).toString();
      if (type === 1) stdout += content;
      else if (type === 2) stderr += content;
    });

    stream.on('end', async () => {
      const info = await exec.inspect();
      resolve({ stdout, stderr, exitCode: info.ExitCode });
    });
  });
}
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && pnpm test tests/container-manager.test.ts
```

Expected: PASS（需要本地 Docker 运行）

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/docker/container-manager.ts packages/server/tests/container-manager.test.ts packages/server/src/types.ts
git commit -m "feat: add container lifecycle management"
```

---

### Task 4: 持久化卷管理

**Files:**
- Create: `packages/server/src/docker/volume-manager.ts`
- Create: `packages/server/tests/volume-manager.test.ts`

- [ ] **Step 1: 写卷管理测试**

```typescript
// tests/volume-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProjectVolume, removeProjectVolume, getVolumePath } from '../src/docker/volume-manager.ts';
import fs from 'fs/promises';
import path from 'path';

describe('Volume Manager', () => {
  const testProjectId = 9999;

  afterEach(async () => {
    try {
      await removeProjectVolume(testProjectId);
    } catch {}
  });

  it('should create a volume directory for a project', async () => {
    const volumePath = await createProjectVolume(testProjectId);
    expect(volumePath).toBeDefined();

    const stat = await fs.stat(volumePath);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should return the correct volume path', () => {
    const path = getVolumePath(testProjectId);
    expect(path).toMatch(/volumes\/project-9999$/);
  });

  it('should remove a volume directory', async () => {
    const volumePath = await createProjectVolume(testProjectId);
    await removeProjectVolume(testProjectId);

    try {
      await fs.stat(volumePath);
      expect.fail('Volume should be removed');
    } catch (error: any) {
      expect(error.code).toBe('ENOENT');
    }
  });
});
```

- [ ] **Step 2: 实现卷管理器**

```typescript
// src/docker/volume-manager.ts
import fs from 'fs/promises';
import path from 'path';

const VOLUMES_BASE_DIR = process.env.VOLUMES_DIR || path.join(process.cwd(), 'volumes');

export function getVolumePath(projectId: number): string {
  return path.join(VOLUMES_BASE_DIR, `project-${projectId}`);
}

export async function createProjectVolume(projectId: number): Promise<string> {
  const volumePath = getVolumePath(projectId);

  await fs.mkdir(volumePath, { recursive: true });

  // 创建基础目录结构
  await fs.mkdir(path.join(volumePath, 'src'), { recursive: true });

  // 创建默认 Dockerfile
  const dockerfileContent = `FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
`;
  await fs.writeFile(path.join(volumePath, 'Dockerfile'), dockerfileContent);

  return volumePath;
}

export async function removeProjectVolume(projectId: number): Promise<void> {
  const volumePath = getVolumePath(projectId);
  await fs.rm(volumePath, { recursive: true, force: true });
}

export async function volumeExists(projectId: number): Promise<boolean> {
  const volumePath = getVolumePath(projectId);
  try {
    await fs.stat(volumePath);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/volume-manager.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/docker/volume-manager.ts packages/server/tests/volume-manager.test.ts
git commit -m "feat: add persistent volume management"
```

---

### Task 5: 容器操作 API 路由

**Files:**
- Create: `packages/server/src/routes/containers.ts`
- Create: `packages/server/tests/containers.test.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 写容器 API 路由测试**

```typescript
// tests/containers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.ts';
import path from 'path';

describe('Containers API', () => {
  let app: any;
  let db: Database.Database;
  let authToken: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    initSchema(db);

    // 创建测试用户
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
      'test',
      'test@test.com',
      'hash'
    );

    // 创建测试项目
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run(
      'test-project',
      'node',
      1
    );

    app = createApp(db);

    // 获取 token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'test' });
    authToken = res.body.token;
  });

  afterEach(() => {
    db.close();
  });

  it('should start a container for a project', async () => {
    const res = await request(app)
      .post(`/api/projects/1/container/start`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.container_id).toBeDefined();
    expect(res.body.status).toBe('running');
  });

  it('should stop a running container', async () => {
    // 先启动
    await request(app)
      .post(`/api/projects/1/container/start`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .post(`/api/projects/1/container/stop`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('stopped');
  });

  it('should get container status', async () => {
    await request(app)
      .post(`/api/projects/1/container/start`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get(`/api/projects/1/container`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });
});
```

- [ ] **Step 2: 实现容器 API 路由**

```typescript
// src/routes/containers.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.ts';
import {
  createProjectContainer,
  startContainer,
  stopContainer,
  removeContainer,
  getContainerStatus,
  getProjectContainer,
} from '../docker/container-manager.ts';
import { createProjectVolume, getVolumePath } from '../docker/volume-manager.ts';
import type { Project } from '../types.ts';

export function createContainersRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/projects/:id/container/start - 启动容器
  router.post('/:id/container/start', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查项目存在性和成员身份
    const project = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;

    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    try {
      // 创建持久化卷（如果不存在）
      await createProjectVolume(projectId);

      const volumePath = getVolumePath(projectId);

      // 创建容器（如果不存在）
      let containerId = project.container_id;
      if (!containerId) {
        containerId = await createProjectContainer(projectId, project.template_type, volumePath);
        db.prepare('UPDATE projects SET container_id = ?, status = ? WHERE id = ?').run(
          containerId,
          'running',
          projectId
        );
      }

      // 启动容器
      await startContainer(containerId);

      res.json({ container_id: containerId, status: 'running' });
    } catch (error) {
      console.error('启动容器失败:', error);
      res.status(500).json({ error: '启动容器失败' });
    }
  });

  // POST /api/projects/:id/container/stop - 停止容器
  router.post('/:id/container/stop', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    const project = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;

    if (!project || !project.container_id) {
      res.status(404).json({ error: '项目或容器不存在' });
      return;
    }

    try {
      await stopContainer(project.container_id);
      db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('stopped', projectId);

      res.json({ container_id: project.container_id, status: 'stopped' });
    } catch (error) {
      console.error('停止容器失败:', error);
      res.status(500).json({ error: '停止容器失败' });
    }
  });

  // GET /api/projects/:id/container - 获取容器状态
  router.get('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    const project = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;

    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    if (!project.container_id) {
      res.json({ container_id: null, status: 'created' });
      return;
    }

    try {
      const dockerStatus = await getContainerStatus(project.container_id);
      res.json({ container_id: project.container_id, status: dockerStatus });
    } catch (error) {
      res.json({ container_id: project.container_id, status: 'unknown' });
    }
  });

  // DELETE /api/projects/:id/container - 删除容器和卷
  router.delete('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 只有 owner 可以删除
    const membership = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId) as { role: string } | undefined;

    if (!membership || membership.role !== 'owner') {
      res.status(403).json({ error: '只有项目 owner 可以删除容器' });
      return;
    }

    const project = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;

    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    try {
      if (project.container_id) {
        await removeContainer(project.container_id);
      }
      await removeProjectVolume(projectId);

      db.prepare('UPDATE projects SET container_id = NULL, status = ? WHERE id = ?').run(
        'created',
        projectId
      );

      res.status(204).send();
    } catch (error) {
      console.error('删除容器失败:', error);
      res.status(500).json({ error: '删除容器失败' });
    }
  });

  return router;
}
```

注意：需要从 volume-manager 导入 removeProjectVolume

- [ ] **Step 3: 在 index.ts 中挂载容器路由**

```typescript
// src/index.ts - 在现有内容基础上添加
import { createContainersRouter } from './routes/containers.ts';

// ... 其他路由挂载
app.use('/api/projects', createContainersRouter(db));
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && pnpm test tests/containers.test.ts
```

Expected: PASS（需要本地 Docker 运行）

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/containers.ts packages/server/tests/containers.test.ts packages/server/src/index.ts
git commit -m "feat: add container operation API routes"
```

---

### Task 6: 构建模板镜像脚本

**Files:**
- Create: `packages/server/scripts/build-templates.sh`

- [ ] **Step 1: 创建构建脚本**

```bash
# scripts/build-templates.sh
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../docker/templates"

echo "Building Docker template images..."

build_template() {
  local template=$1
  local template_dir="$TEMPLATES_DIR/$template"
  local image_name="code-link-$template:latest"

  echo "Building $template template..."
  docker build -t "$image_name" "$template_dir"
  echo "✓ $image_name built successfully"
}

# 构建所有模板
build_template "node"
build_template "node+java"
build_template "node+python"

echo "All template images built successfully!"
```

- [ ] **Step 2: 运行脚本验证**

```bash
cd packages/server && chmod +x scripts/build-templates.sh && ./scripts/build-templates.sh
```

Expected: 三个镜像成功构建

- [ ] **Step 3: 在 package.json 中添加构建脚本**

```json
// packages/server/package.json - 在 scripts 中添加
{
  "scripts": {
    "build:templates": "./scripts/build-templates.sh"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/scripts/build-templates.sh packages/server/package.json
git commit -m "feat: add template image build script"
```

---

### Task 7: 全量测试 + 端到端验证

**Files:**
- Modify: `packages/server/tests/setup.ts`

- [ ] **Step 1: 运行所有测试**

```bash
cd packages/server && pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 2: 手动验证完整流程**

```bash
# 启动服务
pnpm dev:server

# 创建用户
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@test.com","password":"test123"}'

# 登录获取 token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' | jq -r '.token')

# 创建项目
PROJECT_ID=$(curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-project","template_type":"node"}' | jq -r '.id')

# 启动容器
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/container/start \
  -H "Authorization: Bearer $TOKEN"

# 检查容器状态
curl http://localhost:3001/api/projects/$PROJECT_ID/container \
  -H "Authorization: Bearer $TOKEN"

# 检查容器是否真的运行
docker ps | grep "code-link-project-$PROJECT_ID"
```

Expected: 容器正常运行

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: verify Docker container management end-to-end"
```