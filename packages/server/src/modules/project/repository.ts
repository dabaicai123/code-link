import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
import { projects, projectRepos, organizationMembers, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../db/connection.js';
import { PAGINATION_LIMITS } from '../../core/database/constants.js';
import type { InsertProject, SelectProject, SelectProjectRepo } from '../../db/schema/index.js';
import type { ProjectMemberWithUser } from './types.js';

@singleton()
export class ProjectRepository extends BaseRepository {
  constructor(@inject(DatabaseConnection) db: DatabaseConnection) {
    super(db);
  }

  async create(data: InsertProject): Promise<SelectProject> {
    return this.db.insert(projects).values(data).returning().get();
  }

  async findById(id: number): Promise<SelectProject | undefined> {
    return this.db.select().from(projects).where(eq(projects.id, id)).get();
  }

  async delete(id: number): Promise<void> {
    this.db.delete(projects).where(eq(projects.id, id)).run();
  }

  async updateStatus(id: number, status: 'created' | 'running' | 'stopped'): Promise<SelectProject> {
    return this.db.update(projects).set({ status }).where(eq(projects.id, id)).returning().get();
  }

  async updateContainerId(id: number, containerId: string | null): Promise<SelectProject> {
    return this.db.update(projects).set({ containerId }).where(eq(projects.id, id)).returning().get();
  }

  async findByUserId(userId: number, organizationId?: number, limit?: number): Promise<SelectProject[]> {
    const conditions = [eq(organizationMembers.userId, userId)];

    if (organizationId) {
      conditions.push(eq(projects.organizationId, organizationId));
    }

    // When no limit specified, use max; otherwise cap provided limit at max
    const effectiveLimit = limit !== undefined
      ? Math.min(limit, PAGINATION_LIMITS.projects.max)
      : PAGINATION_LIMITS.projects.max;

    return this.db.select({
      id: projects.id,
      name: projects.name,
      templateType: projects.templateType,
      organizationId: projects.organizationId,
      containerId: projects.containerId,
      status: projects.status,
      createdBy: projects.createdBy,
      createdAt: projects.createdAt,
    })
      .from(projects)
      .innerJoin(
        organizationMembers,
        eq(projects.organizationId, organizationMembers.organizationId)
      )
      .where(and(...conditions))
      .limit(effectiveLimit)
      .all();
  }

  async findByOrganizationId(orgId: number): Promise<SelectProject[]> {
    return this.db.select().from(projects).where(eq(projects.organizationId, orgId));
  }

  async findRepos(projectId: number): Promise<SelectProjectRepo[]> {
    return this.db.select().from(projectRepos).where(eq(projectRepos.projectId, projectId));
  }

  async findRepo(repoId: number, projectId: number): Promise<SelectProjectRepo | undefined> {
    return this.db.select()
      .from(projectRepos)
      .where(and(
        eq(projectRepos.id, repoId),
        eq(projectRepos.projectId, projectId)
      ))
      .get();
  }

  async addRepo(data: {
    projectId: number;
    provider: 'github' | 'gitlab';
    repoUrl: string;
    repoName: string;
    branch?: string;
    cloned?: boolean;
  }): Promise<SelectProjectRepo> {
    return this.db.insert(projectRepos).values({
      projectId: data.projectId,
      provider: data.provider,
      repoUrl: data.repoUrl,
      repoName: data.repoName,
      branch: data.branch || 'main',
      cloned: data.cloned || false,
    }).returning().get();
  }

  async deleteRepo(repoId: number): Promise<void> {
    this.db.delete(projectRepos).where(eq(projectRepos.id, repoId)).run();
  }

  async updateRepoCloned(repoId: number, cloned: boolean): Promise<void> {
    this.db.update(projectRepos).set({ cloned }).where(eq(projectRepos.id, repoId)).run();
  }

  async findProjectMembers(orgId: number): Promise<ProjectMemberWithUser[]> {
    const result = await this.db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      role: organizationMembers.role,
    })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId))
      .all();

    return result as ProjectMemberWithUser[];
  }
}
