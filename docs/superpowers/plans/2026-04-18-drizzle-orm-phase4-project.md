# Drizzle ORM 数据库重构 - Phase 4: Project 模块

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Project 模块，使用 Drizzle ORM 替代原生 SQL，创建 Repository 和 Service 层。

**Architecture:** 三层架构 - Repository（数据访问）、Service（业务逻辑）、Routes（HTTP 处理）。类型安全的数据库操作。

**Tech Stack:** Drizzle ORM, Express

---

## 前置条件

- Phase 1 基础设施已完成
- Phase 2 User/Auth 模块已完成
- Phase 3 Organization 模块已完成
- Schema 定义在 `packages/server/src/db/schema/`

---

### Task 1: 创建 Project Repository

**Files:**
- Create: `packages/server/src/repositories/project.repository.ts`
- Modify: `packages/server/src/repositories/index.ts`

- [ ] **Step 1: 创建 Project Repository**

```typescript
// packages/server/src/repositories/project.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  projects,
  projectRepos,
  organizationMembers,
  users,
} from '../db/schema/index.js';
import type { InsertProject, SelectProject, SelectProjectRepo } from '../db/schema/index.js';

export interface ProjectWithOrg extends SelectProject {
  organization_id: number;
}

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
    return db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      role: organizationMembers.role,
    })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId));
  }
}
```

- [ ] **Step 2: 更新 Repositories 导出**

```typescript
// packages/server/src/repositories/index.ts
export { UserRepository } from './user.repository.js';
export { OrganizationRepository } from './organization.repository.js';
export { ProjectRepository } from './project.repository.js';
export type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
} from './organization.repository.js';
export type {
  ProjectWithOrg,
  ProjectMemberWithUser,
  ProjectDetail,
} from './project.repository.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 2: 创建 Project Service

**Files:**
- Create: `packages/server/src/services/project.service.ts`
- Modify: `packages/server/src/services/index.ts`

- [ ] **Step 1: 创建 Project Service**

```typescript
// packages/server/src/services/project.service.ts
import { ProjectRepository } from '../repositories/project.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import type { SelectProject, SelectProjectRepo } from '../db/schema/index.js';
import type { ProjectDetail, ProjectMemberWithUser } from '../repositories/project.repository.js';

export interface CreateProjectInput {
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  organizationId: number;
}

export interface AddRepoInput {
  url: string;
}

export interface ImportRepoInput {
  repoUrl: string;
  branch?: string;
  containerId: string;
}

export class ProjectService {
  private projectRepo = new ProjectRepository();
  private orgRepo = new OrganizationRepository();
  private userRepo = new UserRepository();

  /**
   * 创建项目
   */
  async create(userId: number, input: CreateProjectInput): Promise<SelectProject> {
    // 验证名称
    if (!input.name || typeof input.name !== 'string' || input.name.length > 100) {
      throw new Error('项目名称必须是 1-100 字符的字符串');
    }

    // 验证模板类型
    const validTemplateTypes = ['node', 'node+java', 'node+python'];
    if (!validTemplateTypes.includes(input.templateType)) {
      throw new Error('无效的模板类型，必须是 node, node+java 或 node+python');
    }

    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(input.organizationId, userId);
      if (!membership || !['owner', 'developer'].includes(membership.role)) {
        throw new Error('您没有权限在该组织下创建项目');
      }
    }

    return this.projectRepo.create({
      name: input.name,
      templateType: input.templateType,
      organizationId: input.organizationId,
      createdBy: userId,
    });
  }

  /**
   * 获取用户参与的所有项目
   */
  async findByUserId(userId: number): Promise<SelectProject[]> {
    return this.projectRepo.findByUserId(userId);
  }

  /**
   * 获取项目详情
   */
  async findById(userId: number, projectId: number): Promise<ProjectDetail> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 检查访问权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(project.organizationId!, userId);
      if (!membership) {
        throw new Error('您没有权限访问该项目');
      }
    }

    const members = await this.projectRepo.findProjectMembers(project.organizationId!);
    const repos = await this.projectRepo.findRepos(projectId);

    return { ...project, members, repos };
  }

  /**
   * 删除项目
   */
  async delete(userId: number, projectId: number): Promise<void> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 检查权限
    const user = await this.userRepo.findById(userId);
    const isSuper = user && isSuperAdmin(user.email);

    if (!isSuper) {
      const membership = await this.orgRepo.findUserMembership(project.organizationId!, userId);
      if (!membership || membership.role !== 'owner') {
        throw new Error('只有组织 owner 可以删除项目');
      }
    }

    await this.projectRepo.delete(projectId);
  }

  /**
   * 解析仓库 URL
   */
  parseRepoUrl(url: string): { provider: 'github' | 'gitlab'; repoName: string } | null {
    try {
      const urlObj = new URL(url);

      let provider: 'github' | 'gitlab';
      if (urlObj.hostname === 'github.com') {
        provider = 'github';
      } else if (urlObj.hostname.includes('gitlab')) {
        provider = 'gitlab';
      } else {
        return null;
      }

      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }

      const repoName = `${pathParts[0]}/${pathParts[1].replace('.git', '')}`;
      return { provider, repoName };
    } catch {
      return null;
    }
  }

  /**
   * 检查用户是否是项目成员
   */
  async isProjectMember(projectId: number, userId: number): Promise<boolean> {
    const project = await this.projectRepo.findById(projectId);
    if (!project || !project.organizationId) {
      return false;
    }

    const user = await this.userRepo.findById(userId);
    if (user && isSuperAdmin(user.email)) {
      return true;
    }

    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    return !!membership;
  }

  /**
   * 获取项目仓库列表
   */
  async findRepos(projectId: number, userId: number): Promise<SelectProjectRepo[]> {
    const isMember = await this.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new Error('项目不存在');
    }

    return this.projectRepo.findRepos(projectId);
  }

  /**
   * 添加仓库到项目
   */
  async addRepo(projectId: number, userId: number, input: AddRepoInput): Promise<SelectProjectRepo> {
    const isMember = await this.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new Error('项目不存在');
    }

    const parsed = this.parseRepoUrl(input.url);
    if (!parsed) {
      throw new Error('无效的仓库 URL，仅支持 GitHub 和 GitLab');
    }

    try {
      return await this.projectRepo.addRepo({
        projectId,
        provider: parsed.provider,
        repoUrl: input.url,
        repoName: parsed.repoName,
      });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('该仓库已添加到项目中');
      }
      throw new Error('添加仓库失败');
    }
  }

  /**
   * 删除仓库
   */
  async deleteRepo(projectId: number, userId: number, repoId: number): Promise<void> {
    const isMember = await this.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new Error('项目不存在');
    }

    const repo = await this.projectRepo.findRepo(repoId, projectId);
    if (!repo) {
      throw new Error('仓库不存在');
    }

    await this.projectRepo.deleteRepo(repoId);
  }

  /**
   * 更新仓库克隆状态
   */
  async updateRepoCloned(repoId: number, cloned: boolean): Promise<void> {
    await this.projectRepo.updateRepoCloned(repoId, cloned);
  }

  /**
   * 获取项目信息（用于仓库操作）
   */
  async getProjectForRepo(projectId: number, userId: number): Promise<SelectProject> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const isMember = await this.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new Error('项目不存在');
    }

    return project;
  }
}
```

- [ ] **Step 2: 更新 Services 导出**

```typescript
// packages/server/src/services/index.ts
export { AuthService } from './auth.service.js';
export type { RegisterInput, LoginInput, AuthResult } from './auth.service.js';

export { OrganizationService } from './organization.service.js';
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  OrganizationDetail,
} from './organization.service.js';

export { ProjectService } from './project.service.js';
export type {
  CreateProjectInput,
  AddRepoInput,
  ImportRepoInput,
} from './project.service.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 3: 重构 Projects Routes

**Files:**
- Modify: `packages/server/src/routes/projects.ts`

- [ ] **Step 1: 重构 Projects Routes**

```typescript
// packages/server/src/routes/projects.ts
import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('projects');

export function createProjectsRouter(): Router {
  const router = Router();
  const projectService = new ProjectService();

  // POST /api/projects - 创建项目
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const project = await projectService.create(userId, req.body);
      res.status(201).json(project);
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('名称') || error.message.includes('模板')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('创建项目失败', error);
        res.status(500).json({ error: '创建项目失败' });
      }
    }
  });

  // GET /api/projects - 获取用户参与的所有项目
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const projects = await projectService.findByUserId(userId);
      res.json(projects);
    } catch (error: any) {
      logger.error('获取项目列表失败', error);
      res.status(500).json({ error: '获取项目列表失败' });
    }
  });

  // GET /api/projects/:id - 获取项目详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const project = await projectService.findById(userId, projectId);
      res.json(project);
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取项目详情失败', error);
        res.status(500).json({ error: '获取项目详情失败' });
      }
    }
  });

  // DELETE /api/projects/:id - 删除项目
  router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      await projectService.delete(userId, projectId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('删除项目失败', error);
        res.status(500).json({ error: '删除项目失败' });
      }
    }
  });

  return router;
}
```

---

### Task 4: 重构 Repos Routes

**Files:**
- Modify: `packages/server/src/routes/repos.ts`

- [ ] **Step 1: 重构 Repos Routes**

由于 repos 路由涉及 Docker 容器操作和 Git 克隆，需要保留部分原生 SQL 操作（如事务），但可以将简单的查询迁移到 Service。

```typescript
// packages/server/src/routes/repos.ts
import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { RepoManager } from '../git/repo-manager.js';
import { getContainerInfo } from '../docker/container-manager.js';
import { getDb } from '../db/index.js';
import { projectRepos } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

const logger = createLogger('repos');

export function createReposRouter(): Router {
  const router = Router({ mergeParams: true });
  const projectService = new ProjectService();
  const orgRepo = new OrganizationRepository();
  const repoManager = new RepoManager(getDb());

  // GET / - 获取项目的仓库列表
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const repos = await projectService.findRepos(projectId, userId);
      res.json(repos);
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('获取仓库列表失败', error);
        res.status(500).json({ error: '获取仓库列表失败' });
      }
    }
  });

  // POST / - 添加仓库到项目
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { url } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: '缺少仓库 URL' });
      return;
    }

    try {
      const repo = await projectService.addRepo(projectId, userId, { url });
      res.status(201).json(repo);
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes('无效') || error.message.includes('已添加')) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes('已添加')) {
        res.status(409).json({ error: error.message });
      } else {
        logger.error('添加仓库失败', error);
        res.status(500).json({ error: '添加仓库失败' });
      }
    }
  });

  // POST /import - 导入仓库并克隆到容器
  router.post('/import', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { repoUrl, branch, containerId } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!repoUrl || !containerId) {
      res.status(400).json({ error: '缺少仓库 URL 或容器 ID' });
      return;
    }

    try {
      const project = await projectService.getProjectForRepo(projectId, userId);

      const parsed = projectService.parseRepoUrl(repoUrl);
      if (!parsed) {
        res.status(400).json({ error: '无效的仓库 URL' });
        return;
      }

      // 添加仓库记录（标记为已克隆）
      const repo = await projectService.addRepo(projectId, userId, { url: repoUrl });
      const repoId = repo.id;

      // 克隆到容器
      const cloneResult = await repoManager.cloneRepo(
        containerId,
        projectId,
        repoUrl,
        userId
      );

      if (!cloneResult.success) {
        // 克隆失败，删除数据库记录
        await projectService.deleteRepo(projectId, userId, repoId);
        res.status(500).json({ error: cloneResult.error || '克隆仓库失败' });
        return;
      }

      // 更新克隆状态
      await projectService.updateRepoCloned(repoId, true);

      res.status(201).json({ ...repo, cloned: true, path: cloneResult.path });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes('已添加')) {
        res.status(409).json({ error: error.message });
      } else {
        logger.error('导入仓库失败', error);
        res.status(500).json({ error: '导入仓库失败' });
      }
    }
  });

  // DELETE /:repoId - 删除仓库
  router.delete('/:repoId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    try {
      await projectService.deleteRepo(projectId, userId, repoId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error('删除仓库失败', error);
        res.status(500).json({ error: '删除仓库失败' });
      }
    }
  });

  // POST /:repoId/clone - Clone 仓库（仅 owner）
  router.post('/:repoId/clone', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    try {
      const project = await projectService.getProjectForRepo(projectId, userId);

      // 检查是否是 owner
      const projectOrgId = project.organizationId;
      if (!projectOrgId) {
        res.status(400).json({ error: '项目未关联组织' });
        return;
      }

      const membership = await orgRepo.findUserMembership(projectOrgId, userId);
      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有项目 owner 可以 clone 仓库' });
        return;
      }

      // 获取仓库信息
      const repos = await projectService.findRepos(projectId, userId);
      const repo = repos.find(r => r.id === repoId);
      if (!repo) {
        res.status(404).json({ error: '仓库不存在' });
        return;
      }

      if (!project.containerId) {
        res.status(400).json({ error: '项目容器未启动' });
        return;
      }

      const result = await repoManager.cloneRepo(
        project.containerId,
        projectId,
        repo.repoUrl,
        userId
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      // 更新 cloned 状态
      await projectService.updateRepoCloned(repoId, true);

      res.json({ path: result.path });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('Clone 失败', error);
        res.status(500).json({ error: 'Clone 失败' });
      }
    }
  });

  // POST /:repoId/push - Push 仓库（仅 owner）
  router.post('/:repoId/push', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);
    const { message } = req.body;

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: '缺少 commit message' });
      return;
    }

    try {
      const project = await projectService.getProjectForRepo(projectId, userId);

      // 检查是否是 owner
      const projectOrgId = project.organizationId;
      if (!projectOrgId) {
        res.status(400).json({ error: '项目未关联组织' });
        return;
      }

      const membership = await orgRepo.findUserMembership(projectOrgId, userId);
      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有项目 owner 可以 push 仓库' });
        return;
      }

      // 获取仓库信息
      const repos = await projectService.findRepos(projectId, userId);
      const repo = repos.find(r => r.id === repoId);
      if (!repo) {
        res.status(404).json({ error: '仓库不存在' });
        return;
      }

      if (!project.containerId) {
        res.status(400).json({ error: '项目容器未启动' });
        return;
      }

      // 获取用户信息
      const user = await (await import('../repositories/user.repository.js')).UserRepository.prototype.findById(userId);
      if (!user) {
        res.status(500).json({ error: '用户信息不存在' });
        return;
      }

      const result = await repoManager.pushRepo(
        project.containerId,
        projectId,
        repo.repoUrl,
        repo.branch,
        message,
        userId,
        user.name,
        user.email
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('Push 失败', error);
        res.status(500).json({ error: 'Push 失败' });
      }
    }
  });

  return router;
}
```

---

### Task 5: 更新主入口文件

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 更新路由注册**

修改 `packages/server/src/index.ts`：

```typescript
// 修改前
app.use('/api/projects', createProjectsRouter(db));
app.use('/api/projects/:projectId/repos', createReposRouter(db));

// 修改后
app.use('/api/projects', createProjectsRouter());
app.use('/api/projects/:projectId/repos', createReposRouter());
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 6: 验证功能

**Files:**
- Modify: 无需修改文件

- [ ] **Step 1: 运行现有测试**

```bash
cd packages/server && npm test
```

Expected: 测试通过或无测试文件

- [ ] **Step 2: 启动服务器验证**

```bash
cd packages/server && npm run dev
```

Expected: 服务器启动成功，无错误

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/repositories/project.repository.ts packages/server/src/services/project.service.ts packages/server/src/routes/projects.ts packages/server/src/routes/repos.ts packages/server/src/index.ts
git commit -m "$(cat <<'EOF'
feat(server): refactor project module with Drizzle ORM

- Add ProjectRepository for data access
- Add ProjectService for business logic
- Refactor projects and repos routes
- Remove db parameter from routers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成标准

1. ProjectRepository 已创建并通过编译
2. ProjectService 已创建并通过编译
3. Projects Routes 已重构
4. Repos Routes 已重构
5. 主入口文件已更新
6. 服务器能正常启动
7. 提交已创建

## 后续阶段

完成此阶段后，进入 Phase 5: Draft 模块重构。