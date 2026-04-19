import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { projects } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../core/database/connection.js';
import type { InsertProject, SelectProject } from '../../db/schema/index.js';

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

  async findByOrganizationId(organizationId: number): Promise<SelectProject[]> {
    return this.db.select().from(projects).where(eq(projects.organizationId, organizationId)).all();
  }

  async update(id: number, data: Partial<InsertProject>): Promise<SelectProject> {
    return this.db.update(projects).set(data).where(eq(projects.id, id)).returning().get();
  }

  async delete(id: number): Promise<void> {
    this.db.delete(projects).where(eq(projects.id, id)).run();
  }
}
