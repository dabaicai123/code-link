import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, desc, sql } from 'drizzle-orm';
import { builds } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../db/connection.js';
import { PAGINATION_LIMITS } from '../../core/database/constants.js';
import { computeOffset, computeTotalPages, type PaginatedResult } from '../../core/database/pagination.js';
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

  async findByProjectId(projectId: number, page?: number, limit?: number): Promise<PaginatedResult<SelectBuild>> {
    const effectiveLimit = limit !== undefined
      ? Math.min(limit, PAGINATION_LIMITS.builds.max)
      : PAGINATION_LIMITS.builds.default;
    const effectivePage = page ?? 1;
    const offset = computeOffset(effectivePage, effectiveLimit);

    // Total count
    const countResult = this.db.select({ count: sql<number>`count(*)` })
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .get();
    const total = countResult?.count ?? 0;

    // Paginated data
    const data = this.db.select()
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .orderBy(desc(builds.createdAt))
      .limit(effectiveLimit)
      .offset(offset)
      .all();

    return {
      data,
      meta: {
        page: effectivePage,
        limit: effectiveLimit,
        total,
        totalPages: computeTotalPages(total, effectiveLimit),
      },
    };
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
