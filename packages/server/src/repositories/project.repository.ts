import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  projects,
  projectRepos,
  organizationMembers,
  users,
} from '../db/schema/index.js';
import type { InsertProject, SelectProject, SelectProjectRepo } from '../db/schema/index.js';

export interface ProjectMemberWithUser {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: 'owner' | 'developer' | 'product';
}

export interface ProjectDetail extends SelectProject {
  members: ProjectMemberWithUser[];
  repos: SelectProjectRepo[];
}

export class ProjectRepository {
  /**
   * 根据 ID 查找项目
   */
  async findById(id: number): Promise<SelectProject | undefined> {
    const db = getDb();
    return db.select().from(projects).where(eq(projects.id, id)).get();
  }

  /**
   * 创建项目
   */
  async create(data: InsertProject): Promise<SelectProject> {
    const db = getDb();
    return db.insert(projects).values(data).returning().get();
  }

  /**
   * 删除项目
   */
  async delete(id: number): Promise<void> {
    const db = getDb();
    db.delete(projects).where(eq(projects.id, id)).run();
  }

  /**
   * 更新项目状态
   */
  async updateStatus(id: number, status: 'created' | 'running' | 'stopped'): Promise<SelectProject> {
    const db = getDb();
    return db.update(projects).set({ status }).where(eq(projects.id, id)).returning().get();
  }

  /**
   * 更新项目容器 ID
   */
  async updateContainerId(id: number, containerId: string | null): Promise<SelectProject> {
    const db = getDb();
    return db.update(projects).set({ containerId }).where(eq(projects.id, id)).returning().get();
  }

  /**
   * 获取用户参与的所有项目
   */
  async findByUserId(userId: number): Promise<SelectProject[]> {
    const db = getDb();
    return db.select({
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
      .where(eq(organizationMembers.userId, userId));
  }

  /**
   * 获取组织下的所有项目
   */
  async findByOrganizationId(orgId: number): Promise<SelectProject[]> {
    const db = getDb();
    return db.select().from(projects).where(eq(projects.organizationId, orgId));
  }

  /**
   * 获取项目仓库列表
   */
  async findRepos(projectId: number): Promise<SelectProjectRepo[]> {
    const db = getDb();
    return db.select().from(projectRepos).where(eq(projectRepos.projectId, projectId));
  }

  /**
   * 查找项目仓库
   */
  async findRepo(repoId: number, projectId: number): Promise<SelectProjectRepo | undefined> {
    const db = getDb();
    return db.select()
      .from(projectRepos)
      .where(and(
        eq(projectRepos.id, repoId),
        eq(projectRepos.projectId, projectId)
      ))
      .get();
  }

  /**
   * 添加仓库到项目
   */
  async addRepo(data: {
    projectId: number;
    provider: 'github' | 'gitlab';
    repoUrl: string;
    repoName: string;
    branch?: string;
    cloned?: boolean;
  }): Promise<SelectProjectRepo> {
    const db = getDb();
    return db.insert(projectRepos).values({
      projectId: data.projectId,
      provider: data.provider,
      repoUrl: data.repoUrl,
      repoName: data.repoName,
      branch: data.branch || 'main',
      cloned: data.cloned || false,
    }).returning().get();
  }

  /**
   * 删除仓库
   */
  async deleteRepo(repoId: number): Promise<void> {
    const db = getDb();
    db.delete(projectRepos).where(eq(projectRepos.id, repoId)).run();
  }

  /**
   * 更新仓库克隆状态
   */
  async updateRepoCloned(repoId: number, cloned: boolean): Promise<void> {
    const db = getDb();
    db.update(projectRepos).set({ cloned }).where(eq(projectRepos.id, repoId)).run();
  }

  /**
   * 获取组织成员作为项目成员列表
   */
  async findProjectMembers(orgId: number): Promise<ProjectMemberWithUser[]> {
    const db = getDb();
    const result = db.select({
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