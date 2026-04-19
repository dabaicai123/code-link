import "reflect-metadata";
import { singleton } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../core/database/connection.js';
import type { InsertUser, SelectUser } from '../../db/schema/index.js';

@singleton()
export class AuthRepository extends BaseRepository {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  async findByEmail(email: string): Promise<SelectUser | undefined> {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }

  async findById(id: number): Promise<SelectUser | undefined> {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }

  async create(data: InsertUser): Promise<SelectUser> {
    return this.db.insert(users).values(data).returning().get();
  }

  async findEmailById(id: number): Promise<string | undefined> {
    const result = this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .get();
    return result?.email;
  }

  async updateAvatar(id: number, avatar: string): Promise<SelectUser> {
    return this.db.update(users).set({ avatar }).where(eq(users.id, id)).returning().get();
  }

  async delete(id: number): Promise<void> {
    this.db.delete(users).where(eq(users.id, id)).run();
  }
}
