import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, desc } from 'drizzle-orm';
import { builds } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../core/database/connection.js';
import type { InsertBuild, SelectBuild } from '../../db/schema/index.js';

@singleton()
export class BuildRepository extends BaseRepository {
  constructor(@inject(DatabaseConnection) db: DatabaseConnection) {
    super(db);
  }

  async create(data: InsertBuild): Promise<SelectBuild> {
    return this.db.insert(builds).values(data).returning().get();
  }

  async findById(buildId: number): Promise<SelectBuild | undefined> {
    return this.db.select().from(builds).where(eq(builds.id, buildId)).get();
  }

  async updateStatus(buildId: number, status: SelectBuild['status'], previewPort?: number): Promise<SelectBuild> {
    return this.db.update(builds)
      .set({ status, previewPort: previewPort ?? null })
      .where(eq(builds.id, buildId))
      .returning()
      .get();
  }

  async findByProjectId(projectId: number): Promise<SelectBuild[]> {
    return this.db.select()
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .orderBy(desc(builds.createdAt));
  }

  async findLatestByProjectId(projectId: number): Promise<SelectBuild | undefined> {
    return this.db.select()
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1)
      .get();
  }
}
