import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema/index.js';
import type { InsertUser, SelectUser } from '../db/schema/index.js';

export class UserRepository {
  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<SelectUser | undefined> {
    const db = getDb();
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: number): Promise<SelectUser | undefined> {
    const db = getDb();
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  /**
   * 创建用户
   */
  async create(data: InsertUser): Promise<SelectUser> {
    const db = getDb();
    return db.insert(users).values(data).returning().get();
  }

  /**
   * 更新用户头像
   */
  async updateAvatar(id: number, avatar: string): Promise<SelectUser> {
    const db = getDb();
    return db.update(users).set({ avatar }).where(eq(users.id, id)).returning().get();
  }

  /**
   * 更新用户信息
   */
  async update(id: number, data: Partial<Pick<InsertUser, 'name' | 'avatar'>>): Promise<SelectUser> {
    const db = getDb();
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  /**
   * 删除用户
   */
  async delete(id: number): Promise<void> {
    const db = getDb();
    db.delete(users).where(eq(users.id, id)).run();
  }
}