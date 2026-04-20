import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  users,
  organizations,
  organizationMembers,
  organizationInvitations,
  projects,
  drafts,
  draftMembers,
  draftMessages,
} from '@code-link/server/dist/db/schema/index.js';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

export type DrizzleDb = ReturnType<typeof drizzle>;

export function createDrizzleFromSqlite(sqlite: Database.Database): DrizzleDb {
  return drizzle(sqlite);
}

export async function seedTestUser(
  db: DrizzleDb,
  overrides?: Partial<TestUser>
): Promise<TestUser> {
  const email = overrides?.email || 'test@example.com';
  const name = overrides?.name || 'Test User';
  const password = overrides?.password || 'testpassword';
  const passwordHash = bcrypt.hashSync(password, 10);

  const result = await db.insert(users).values({
    name,
    email,
    passwordHash,
  }).returning().get();

  return { id: result.id, email, name, password };
}

export async function seedTestOrganization(
  db: DrizzleDb,
  userId: number,
  name?: string
): Promise<number> {
  const orgName = name || 'Test Organization';

  const result = await db.insert(organizations).values({
    name: orgName,
    createdBy: userId,
  }).returning().get();

  const orgId = result.id;

  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId,
    role: 'owner',
    invitedBy: userId,
  });

  return orgId;
}

export async function seedTestProject(
  db: DrizzleDb,
  userId: number,
  organizationId: number,
  overrides?: { name?: string; templateType?: 'node' | 'node+java' | 'node+python' }
): Promise<number> {
  const projectName = overrides?.name || 'Test Project';
  const templateType = overrides?.templateType || 'node';

  const result = await db.insert(projects).values({
    name: projectName,
    templateType,
    organizationId,
    createdBy: userId,
    status: 'created',
  }).returning().get();

  return result.id;
}

export async function seedTestInvitation(
  db: DrizzleDb,
  organizationId: number,
  invitedBy: number,
  overrides?: { email?: string; role?: 'owner' | 'developer' | 'member'; status?: 'pending' | 'accepted' | 'declined' }
): Promise<number> {
  const email = overrides?.email || 'invited@example.com';
  const role = overrides?.role || 'member';
  const status = overrides?.status || 'pending';

  const result = await db.insert(organizationInvitations).values({
    organizationId,
    email,
    role,
    invitedBy,
    status,
  }).returning().get();

  return result.id;
}
