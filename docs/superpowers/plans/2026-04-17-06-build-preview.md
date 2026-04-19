# 构建预览实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现构建预览功能 — 从项目容器读取 Dockerfile 构建新镜像、启动预览容器映射随机端口、前端 iframe 展示预览效果、构建状态实时推送。

**Architecture:** 服务端接收构建请求后，从项目容器挂载的持久化卷读取 Dockerfile，调用 Docker build API 构建镜像，然后启动预览容器。预览容器映射到随机高端口（30000-40000），前端通过 iframe 指向该端口。构建状态通过 WebSocket 实时推送给所有在线用户。

**Tech Stack:** Docker build API, Docker run API, 端口管理, WebSocket 状态推送

---

## 文件结构

```
packages/server/
├── src/
│   ├── build/
│   │   ├── build-manager.ts       # 构建流程管理
│   │   ├── port-manager.ts        # 预览端口分配
│   │   └── preview-container.ts   # 预览容器管理
│   ├── routes/
│   │   └── builds.ts              # 构建 API 路由
│   ├── index.ts                   # 挂载构建路由
│   └── types.ts                   # 更新 Build 类型
├── tests/
│   ├── build-manager.test.ts
│   ├── port-manager.test.ts
│   └: builds.test.ts

packages/web/
├── src/
│   ├── components/
│   │   └── preview-frame.tsx      # iframe 预览组件
│   │   └: build-status.tsx        # 构建状态显示
│   └── hooks/
│       └: use-build.ts            # 构建 Hook
```

---

### Task 1: 端口管理

**Files:**
- Create: `packages/server/src/build/port-manager.ts`
- Create: `packages/server/tests/port-manager.test.ts`

- [ ] **Step 1: 写端口管理测试**

```typescript
// tests/port-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PortManager } from '../src/build/port-manager.ts';

describe('PortManager', () => {
  let manager: PortManager;

  beforeEach(() => {
    manager = new PortManager(30000, 40000);
  });

  it('should allocate a port', () => {
    const port = manager.allocatePort();
    expect(port).toBeGreaterThanOrEqual(30000);
    expect(port).toBeLessThanOrEqual(40000);
  });

  it('should not allocate the same port twice', () => {
    const port1 = manager.allocatePort();
    const port2 = manager.allocatePort();

    expect(port1).not.toBe(port2);
  });

  it('should release a port', () => {
    const port = manager.allocatePort();
    manager.releasePort(port);

    // 再次分配应该可能得到相同的端口
    const newPort = manager.allocatePort();
    expect(newPort).toBe(port);
  });

  it('should check if port is in use', () => {
    const port = manager.allocatePort();

    expect(manager.isPortInUse(port)).toBe(true);
    expect(manager.isPortInUse(30001)).toBe(false);
  });

  it('should get all allocated ports', () => {
    manager.allocatePort();
    manager.allocatePort();

    const ports = manager.getAllocatedPorts();
    expect(ports.size).toBe(2);
  });
});
```

- [ ] **Step 2: 实现端口管理器**

```typescript
// src/build/port-manager.ts
export class PortManager {
  private minPort: number;
  private maxPort: number;
  private allocatedPorts: Set<number> = new Set();
  private nextPort: number;

  constructor(minPort: number = 30000, maxPort: number = 40000) {
    this.minPort = minPort;
    this.maxPort = maxPort;
    this.nextPort = minPort;
  }

  allocatePort(): number {
    // 从下一个可用端口开始查找
    for (let i = this.nextPort; i <= this.maxPort; i++) {
      if (!this.allocatedPorts.has(i)) {
        this.allocatedPorts.add(i);
        this.nextPort = i + 1;
        return i;
      }
    }

    // 从头开始查找
    for (let i = this.minPort; i < this.nextPort; i++) {
      if (!this.allocatedPorts.has(i)) {
        this.allocatedPorts.add(i);
        this.nextPort = i + 1;
        return i;
      }
    }

    throw new Error('No available ports');
  }

  releasePort(port: number): void {
    this.allocatedPorts.delete(port);
  }

  isPortInUse(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  getAllocatedPorts(): Set<number> {
    return new Set(this.allocatedPorts);
  }
}

// 全局单例
let portManagerInstance: PortManager | null = null;

export function getPortManager(): PortManager {
  if (!portManagerInstance) {
    portManagerInstance = new PortManager();
  }
  return portManagerInstance;
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/port-manager.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/build/port-manager.ts packages/server/tests/port-manager.test.ts
git commit -m "feat: add port manager for preview containers"
```

---

### Task 2: 预览容器管理

**Files:**
- Create: `packages/server/src/build/preview-container.ts`
- Create: `packages/server/tests/preview-container.test.ts`

- [ ] **Step 1: 写预览容器测试**

```typescript
// tests/preview-container.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreviewContainerManager } from '../src/build/preview-container.ts';
import { getDockerClient } from '../src/docker/client.ts';
import { getPortManager } from '../src/build/port-manager.ts';

describe('PreviewContainerManager', () => {
  let manager: PreviewContainerManager;
  let testImageId: string;

  beforeEach(async () => {
    manager = new PreviewContainerManager();

    // 构建一个简单的测试镜像
    const docker = getDockerClient();
    const stream = await docker.buildImage({
      fromImage: 'node:20-slim',
    });

    await new Promise((resolve) => stream.on('end', resolve));

    const images = await docker.listImages();
    testImageId = images[0]?.Id;
  });

  afterEach(async () => {
    manager.cleanupAll();
  });

  it('should create preview container', async () => {
    const port = await manager.createPreviewContainer(testImageId, 'test-project-1');

    expect(port).toBeGreaterThanOrEqual(30000);
    expect(port).toBeLessThanOrEqual(40000);
  });

  it('should stop preview container', async () => {
    const port = await manager.createPreviewContainer(testImageId, 'test-project-2');

    await manager.stopPreviewContainer('test-project-2');

    const docker = getDockerClient();
    try {
      const container = docker.getContainer(`code-link-preview-test-project-2`);
      const info = await container.inspect();
      expect(info.State.Status).toBe('exited');
    } catch {}
  });

  it('should get preview URL', () => {
    const url = manager.getPreviewUrl(30001);
    expect(url).toBe('http://localhost:30001');
  });
});
```

- [ ] **Step 2: 实现预览容器管理器**

```typescript
// src/build/preview-container.ts
import { getDockerClient } from '../docker/container-manager.ts';
import { getPortManager } from './port-manager.ts';

const PREVIEW_CONTAINER_PREFIX = 'code-link-preview-';

interface PreviewContainer {
  containerId: string;
  projectId: string;
  port: number;
  createdAt: Date;
}

export class PreviewContainerManager {
  private containers: Map<string, PreviewContainer> = new Map();

  async createPreviewContainer(
    imageId: string,
    projectId: string,
    env?: Record<string, string>
  ): Promise<number> {
    const docker = getDockerClient();
    const portManager = getPortManager();

    // 分配端口
    const port = portManager.allocatePort();

    // 停止并移除旧的预览容器（如果存在）
    await this.stopPreviewContainer(projectId);

    // 创建并启动容器
    const container = await docker.createContainer({
      name: `${PREVIEW_CONTAINER_PREFIX}${projectId}`,
      Image: imageId,
      ExposedPorts: {
        '3000/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          '3000/tcp': [{ HostPort: port.toString() }],
        },
      },
      Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : [],
    });

    await container.start();

    // 记录容器信息
    this.containers.set(projectId, {
      containerId: container.id,
      projectId,
      port,
      createdAt: new Date(),
    });

    return port;
  }

  async stopPreviewContainer(projectId: string): Promise<void> {
    const docker = getDockerClient();
    const info = this.containers.get(projectId);

    if (info) {
      try {
        const container = docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
      } catch {}
      this.containers.delete(projectId);
    } else {
      // 尝试通过名称查找
      try {
        const container = docker.getContainer(`${PREVIEW_CONTAINER_PREFIX}${projectId}`);
        const info = await container.inspect();
        await container.stop();
        await container.remove();
      } catch {}
    }
  }

  getPreviewUrl(port: number): string {
    const host = process.env.PREVIEW_HOST || 'localhost';
    return `http://${host}:${port}`;
  }

  getContainerInfo(projectId: string): PreviewContainer | undefined {
    return this.containers.get(projectId);
  }

  async cleanupAll(): Promise<void> {
    const docker = getDockerClient();

    for (const [projectId, info] of this.containers) {
      try {
        const container = docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
      } catch {}
    }

    this.containers.clear();
  }
}

// 全局单例
let previewManagerInstance: PreviewContainerManager | null = null;

export function getPreviewContainerManager(): PreviewContainerManager {
  if (!previewManagerInstance) {
    previewManagerInstance = new PreviewContainerManager();
  }
  return previewManagerInstance;
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/preview-container.test.ts
```

Expected: PASS（需要本地 Docker 运行）

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/build/preview-container.ts packages/server/tests/preview-container.test.ts
git commit -m "feat: add preview container manager"
```

---

### Task 3: 构建管理器

**Files:**
- Create: `packages/server/src/build/build-manager.ts`
- Create: `packages/server/tests/build-manager.test.ts`

- [ ] **Step 1: 写构建管理测试**

```typescript
// tests/build-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.ts';
import { BuildManager } from '../src/build/build-manager.ts';
import { getWebSocketServer } from '../src/websocket/server.ts';

describe('BuildManager', () => {
  let db: Database.Database;
  let manager: BuildManager;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);
    manager = new BuildManager(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create build record', async () => {
    const build = await manager.createBuild(1);

    expect(build.project_id).toBe(1);
    expect(build.status).toBe('pending');
  });

  it('should update build status', async () => {
    const build = await manager.createBuild(1);

    await manager.updateBuildStatus(build.id, 'running');
    const updated = manager.getBuild(build.id);

    expect(updated?.status).toBe('running');
  });

  it('should get project builds', async () => {
    await manager.createBuild(1);
    await manager.createBuild(1);

    const builds = manager.getProjectBuilds(1);

    expect(builds.length).toBe(2);
  });

  it('should build from project volume', async () => {
    // 这个测试需要真实容器，这里只测试接口
    const build = await manager.createBuild(1);

    // 模拟构建完成
    await manager.updateBuildStatus(build.id, 'success', 30001);

    const updated = manager.getBuild(build.id);
    expect(updated?.status).toBe('success');
    expect(updated?.preview_port).toBe(30001);
  });
});
```

- [ ] **Step 2: 实现构建管理器**

```typescript
// src/build/build-manager.ts
import type Database from 'better-sqlite3';
import { getDockerClient } from '../docker/client.ts';
import { getVolumePath } from '../docker/volume-manager.ts';
import { getPreviewContainerManager } from './preview-container.ts';
import { getWebSocketServer } from '../websocket/server.ts';
import type { Build } from '../types.ts';

export class BuildManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async createBuild(projectId: number): Promise<Build> {
    const result = this.db
      .prepare('INSERT INTO builds (project_id, status) VALUES (?, ?)')
      .run(projectId, 'pending');

    const build = this.db
      .prepare('SELECT * FROM builds WHERE id = ?')
      .get(result.lastInsertRowid) as Build;

    // 通知 WebSocket 客户端
    this.notifyBuildStatus(projectId, 'pending');

    return build;
  }

  async startBuild(projectId: number, buildId: number): Promise<void> {
    const project = this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as any;

    if (!project) {
      throw new Error('Project not found');
    }

    // 更新状态为 running
    await this.updateBuildStatus(buildId, 'running');

    try {
      const docker = getDockerClient();
      const volumePath = getVolumePath(projectId);

      // 构建 Docker 镜像
      const stream = await docker.buildImage(
        { context: volumePath, src: ['.'] },
        { t: `code-link-build-${buildId}:latest` }
      );

      // 等待构建完成
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (err, output) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 启动预览容器
      const previewManager = getPreviewContainerManager();
      const previewPort = await previewManager.createPreviewContainer(
        `code-link-build-${buildId}:latest`,
        projectId.toString()
      );

      // 更新状态为 success
      await this.updateBuildStatus(buildId, 'success', previewPort);
    } catch (error: any) {
      // 更新状态为 failed
      await this.updateBuildStatus(buildId, 'failed');
      throw error;
    }
  }

  async updateBuildStatus(
    buildId: number,
    status: Build['status'],
    previewPort?: number
  ): Promise<void> {
    this.db
      .prepare('UPDATE builds SET status = ?, preview_port = ? WHERE id = ?')
      .run(status, previewPort || null, buildId);

    // 获取项目 ID 并通知 WebSocket 客户端
    const build = this.getBuild(buildId);
    if (build) {
      this.notifyBuildStatus(build.project_id, status, previewPort);
    }
  }

  getBuild(buildId: number): Build | null {
    return this.db
      .prepare('SELECT * FROM builds WHERE id = ?')
      .get(buildId) as Build | null;
  }

  getProjectBuilds(projectId: number): Build[] {
    return this.db
      .prepare('SELECT * FROM builds WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as Build[];
  }

  getLatestBuild(projectId: number): Build | null {
    return this.db
      .prepare('SELECT * FROM builds WHERE project_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(projectId) as Build | null;
  }

  private notifyBuildStatus(
    projectId: number,
    status: string,
    previewPort?: number
  ): void {
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastBuildStatus(projectId, status, previewPort);
    }
  }
}

// 全局单例
let buildManagerInstance: BuildManager | null = null;

export function getBuildManager(db: Database.Database): BuildManager {
  if (!buildManagerInstance) {
    buildManagerInstance = new BuildManager(db);
  }
  return buildManagerInstance;
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/build-manager.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/build/build-manager.ts packages/server/tests/build-manager.test.ts
git commit -m "feat: add build manager with Docker build support"
```

---

### Task 4: 构建 API 路由

**Files:**
- Create: `packages/server/src/routes/builds.ts`
- Create: `packages/server/tests/builds.test.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 写构建 API 测试**

```typescript
// tests/builds.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.ts';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.ts';

describe('Builds API', () => {
  let app: any;
  let db: Database.Database;
  let authToken: string;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);

    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
      'test',
      'test@test.com',
      'hash'
    );

    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run(
      'test-project',
      'node',
      1
    );

    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
      1,
      1,
      'owner'
    );

    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create a build', async () => {
    const res = await request(app)
      .post('/api/builds')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ projectId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.project_id).toBe(1);
    expect(res.body.status).toBe('pending');
  });

  it('should get project builds', async () => {
    // 先创建构建
    await request(app)
      .post('/api/builds')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ projectId: 1 });

    const res = await request(app)
      .get('/api/builds/project/1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('should get build by id', async () => {
    const createRes = await request(app)
      .post('/api/builds')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ projectId: 1 });

    const res = await request(app)
      .get(`/api/builds/${createRes.body.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });
});
```

- [ ] **Step 2: 实现构建 API 路由**

```typescript
// src/routes/builds.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.ts';
import { getBuildManager } from '../build/build-manager.ts';
import { getPreviewContainerManager } from '../build/preview-container.ts';
import type { Project } from '../types.ts';

export function createBuildsRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/builds - 创建构建
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json({ error: '缺少 projectId' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    try {
      const buildManager = getBuildManager(db);
      const build = await buildManager.createBuild(projectId);

      // 异步启动构建（不等待）
      buildManager.startBuild(projectId, build.id).catch((error) => {
        console.error('Build failed:', error);
      });

      res.status(201).json(build);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/builds/project/:projectId - 获取项目的构建列表
  router.get('/project/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const buildManager = getBuildManager(db);
    const builds = buildManager.getProjectBuilds(projectId);

    res.json(builds);
  });

  // GET /api/builds/:id - 获取构建详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const buildId = parseInt(req.params.id, 10);

    if (isNaN(buildId)) {
      res.status(400).json({ error: '无效的构建 ID' });
      return;
    }

    const buildManager = getBuildManager(db);
    const build = buildManager.getBuild(buildId);

    if (!build) {
      res.status(404).json({ error: '构建不存在' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(build.project_id, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此构建' });
      return;
    }

    res.json(build);
  });

  // GET /api/builds/preview/:projectId - 获取项目预览 URL
  router.get('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const previewManager = getPreviewContainerManager();
    const containerInfo = previewManager.getContainerInfo(projectId.toString());

    if (!containerInfo) {
      res.status(404).json({ error: '预览容器未运行' });
      return;
    }

    res.json({
      url: previewManager.getPreviewUrl(containerInfo.port),
      port: containerInfo.port,
    });
  });

  // DELETE /api/builds/preview/:projectId - 停止预览容器
  router.delete('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const previewManager = getPreviewContainerManager();
    await previewManager.stopPreviewContainer(projectId.toString());

    res.status(204).send();
  });

  return router;
}
```

- [ ] **Step 3: 挂载路由**

```typescript
// src/index.ts - 在 createApp 中添加
import { createBuildsRouter } from './routes/builds.ts';

// 挂载路由
app.use('/api/builds', createBuildsRouter(db));
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && pnpm test tests/builds.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/builds.ts packages/server/tests/builds.test.ts packages/server/src/index.ts
git commit -m "feat: add build API routes"
```

---

### Task 5: 前端预览组件

**Files:**
- Create: `packages/web/src/components/preview-frame.tsx`
- Create: `packages/web/src/components/build-status.tsx`
- Create: `packages/web/src/hooks/use-build.ts`

- [ ] **Step 1: 实现预览 iframe 组件**

```typescript
// src/components/preview-frame.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface PreviewFrameProps {
  projectId: number;
}

export function PreviewFrame({ projectId }: PreviewFrameProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBuild = async () => {
    setLoading(true);
    setError(null);

    try {
      await api.post('/api/builds', { projectId });
      // 构建状态通过 WebSocket 更新
    } catch (err: any) {
      setError(err.response?.data?.error || '构建失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      const response = await api.get(`/api/builds/preview/${projectId}`);
      setPreviewUrl(response.data.url);
    } catch {}
  };

  useEffect(() => {
    loadPreview();
  }, [projectId]);

  return (
    <div className="preview-frame">
      <div className="preview-toolbar">
        <button onClick={startBuild} disabled={loading}>
          {loading ? '构建中...' : '构建预览'}
        </button>
        {previewUrl && (
          <button onClick={loadPreview}>刷新预览</button>
        )}
      </div>

      {error && (
        <div className="preview-error">
          {error}
        </div>
      )}

      {previewUrl ? (
        <iframe
          src={previewUrl}
          className="preview-iframe"
          style={{
            width: '100%',
            height: '500px',
            border: '1px solid #ccc',
          }}
        />
      ) : (
        <div className="preview-placeholder">
          点击"构建预览"开始
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 实现构建状态组件**

```typescript
// src/components/build-status.tsx
'use client';

import { useState, useEffect } from 'react';
import { useProjectSync } from '@/hooks/use-project-sync';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface BuildStatusProps {
  projectId: number;
}

export function BuildStatus({ projectId }: BuildStatusProps) {
  const { user } = useAuth();
  const { buildStatus, isConnected } = useProjectSync(
    projectId,
    user?.id || 0,
    user?.name || ''
  );

  const [builds, setBuilds] = useState<any[]>([]);

  useEffect(() => {
    loadBuilds();
  }, [projectId]);

  useEffect(() => {
    if (buildStatus?.status === 'success' || buildStatus?.status === 'failed') {
      loadBuilds();
    }
  }, [buildStatus]);

  const loadBuilds = async () => {
    try {
      const response = await api.get(`/api/builds/project/${projectId}`);
      setBuilds(response.data);
    } catch {}
  };

  return (
    <div className="build-status">
      <h3>构建状态</h3>

      {!isConnected && <div className="warning">WebSocket 未连接</div>}

      {buildStatus && (
        <div className={`current-status status-${buildStatus.status}`}>
          当前状态: {buildStatus.status}
          {buildStatus.previewPort && (
            <span> (端口: {buildStatus.previewPort})</span>
          )}
        </div>
      )}

      <h4>构建历史</h4>
      <ul>
        {builds.map((build) => (
          <li key={build.id} className={`build-item status-${build.status}`}>
            <span>#{build.id}</span>
            <span>{build.status}</span>
            <span>{new Date(build.created_at).toLocaleString()}</span>
            {build.preview_port && (
              <span>:{build.preview_port}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: 实现构建 Hook**

```typescript
// src/hooks/use-build.ts
'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export function useBuild(projectId: number) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBuild = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/builds', { projectId });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || '构建失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const getBuilds = useCallback(async () => {
    try {
      const response = await api.get(`/api/builds/project/${projectId}`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || '获取构建列表失败');
      throw err;
    }
  }, [projectId]);

  const getPreviewUrl = useCallback(async () => {
    try {
      const response = await api.get(`/api/builds/preview/${projectId}`);
      return response.data.url;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      setError(err.response?.data?.error || '获取预览 URL 失败');
      throw err;
    }
  }, [projectId]);

  const stopPreview = useCallback(async () => {
    try {
      await api.delete(`/api/builds/preview/${projectId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || '停止预览失败');
      throw err;
    }
  }, [projectId]);

  return {
    loading,
    error,
    startBuild,
    getBuilds,
    getPreviewUrl,
    stopPreview,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/preview-frame.tsx packages/web/src/components/build-status.tsx packages/web/src/hooks/use-build.ts
git commit -m "feat: add frontend build preview components"
```

---

### Task 6: 全量测试 + 端到端验证

**Files:**
- None (测试现有功能)

- [ ] **Step 1: 运行所有测试**

```bash
cd packages/server && pnpm test
cd packages/web && pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 2: 手动验证完整流程**

```bash
# 启动服务
pnpm dev

# 创建项目并启动容器
# 在项目容器内创建一个简单的 Node.js 应用
# 编写 Dockerfile

# 触发构建
curl -X POST http://localhost:3001/api/builds \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":1}'

# 检查构建状态
curl http://localhost:3001/api/builds/project/1 \
  -H "Authorization: Bearer $TOKEN"

# 获取预览 URL
curl http://localhost:3001/api/builds/preview/1 \
  -H "Authorization: Bearer $TOKEN"

# 在浏览器中打开预览 URL 验证
```

Expected: 构建成功，预览容器运行，iframe 正常显示

- [ ] **Step 3: 测试 WebSocket 实时状态推送**

```bash
# 打开两个浏览器窗口
# 窗口 1: 触发构建
# 窗口 2: 观察构建状态实时更新
```

Expected: 构建状态实时推送到所有在线用户

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify build preview end-to-end"
```