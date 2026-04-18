import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { builds } from '../db/schema/index.js';
import type { InsertBuild, SelectBuild } from '../db/schema/index.js';

export class BuildRepository {
  /**
   * 创建构建
   */
  async create(projectId: number): Promise<SelectBuild> {
    const db = getDb();
    return db.insert(builds)
      .values({ projectId, status: 'pending' })
      .returning()
      .get();
  }

  /**
   * 根据 ID 查找构建
   */
  async findById(buildId: number): Promise<SelectBuild | undefined> {
    const db = getDb();
    return db.select().from(builds).where(eq(builds.id, buildId)).get();
  }

  /**
   * 更新构建状态
   */
  async updateStatus(buildId: number, status: 'pending' | 'running' | 'success' | 'failed', previewPort?: number): Promise<SelectBuild> {
    const db = getDb();
    return db.update(builds)
      .set({ status, previewPort: previewPort ?? null })
      .where(eq(builds.id, buildId))
      .returning()
      .get();
  }

  /**
   * 获取项目的构建列表
   */
  async findByProjectId(projectId: number): Promise<SelectBuild[]> {
    const db = getDb();
    return db.select()
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .orderBy(desc(builds.createdAt));
  }

  /**
   * 获取项目的最新构建
   */
  async findLatestByProjectId(projectId: number): Promise<SelectBuild | undefined> {
    const db = getDb();
    return db.select()
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1)
      .get();
  }
}