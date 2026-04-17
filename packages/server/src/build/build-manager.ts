// src/build/build-manager.ts
import type Database from 'better-sqlite3';
import { getDockerClient } from '../docker/client.js';
import { getVolumePath } from '../docker/volume-manager.js';
import { getPreviewContainerManager } from './preview-container.js';
import { getWebSocketServer } from '../websocket/server.js';
import type { Build } from '../types.js';

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
    const build = this.db
      .prepare('SELECT * FROM builds WHERE id = ?')
      .get(buildId) as Build | undefined;
    return build ?? null;
  }

  getProjectBuilds(projectId: number): Build[] {
    return this.db
      .prepare('SELECT * FROM builds WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as Build[];
  }

  getLatestBuild(projectId: number): Build | null {
    const build = this.db
      .prepare('SELECT * FROM builds WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .get(projectId) as Build | undefined;
    return build ?? null;
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

// 重置实例（用于测试）
export function resetBuildManagerInstance(): void {
  buildManagerInstance = null;
}