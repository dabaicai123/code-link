# 后端架构大重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 code-link 后端进行一次性全面重构，解决架构、性能、设计不合理的问题。

**Architecture:** 使用依赖注入容器统一管理 Repository 和 Service 实例；创建 PermissionService 统一权限检查；删除 raw SQL schema，统一使用 Drizzle ORM；删除 types.ts，使用 Drizzle schema 导出类型。

**Tech Stack:** Node.js, Express, Drizzle ORM, SQLite, TypeScript, WebSocket

---

## 文件结构变更

```
packages/server/src/
├── container.ts                    # 新增：DI 容器
├── errors/                         # 已存在，微调
│   └── index.ts                    
├── db/
│   ├── client.ts                   # 重命名自 drizzle.ts，简化
│   ├── schema.ts                   # 删除：raw SQL schema
│   ├── init.ts                     # 简化：只保留 initDefaultAdmin
│   ├── schema/                     # 保留
│   └── index.ts                    # 重构
├── services/
│   ├── permission.service.ts       # 新增：统一权限服务
│   ├── container.ts                # 新增：Service 工厂
│   └── *.service.ts                # 重构：使用 DI
├── repositories/
│   └── *.repository.ts             # 重构：单例模式
├── routes/
│   └── *.ts                        # 重构：使用 handleRouteError
├── types.ts                        # 删除：类型迁移到 schema
└── index.ts                        # 重构：使用容器初始化
```

---

### Task 1: 统一错误处理 - 增强 BusinessError

**Files:**
- Modify: `packages/server/src/utils/errors.ts`
- Test: `packages/server/tests/errors.test.ts`

- [ ] **Step 1: Write the failing test for error codes**

```typescript
// packages/server/tests/errors.test.ts
import { describe, it, expect } from 'vitest';
import { BusinessError, PermissionError, NotFoundError, ParamError, ConflictError, AuthError } from '../src/utils/errors.js';

describe('BusinessError', () => {
  it('should have correct code and httpStatus', () => {
    const error = new PermissionError();
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
  });

  it('NotFoundError should include resource name', () => {
    const error = new NotFoundError('项目');
    expect(error.message).toBe('项目不存在');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.httpStatus).toBe(404);
  });

  it('ParamError should have custom message', () => {
    const error = new ParamError('名称不能为空');
    expect(error.message).toBe('名称不能为空');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.httpStatus).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test tests/errors.test.ts`
Expected: PASS (现有实现已满足)

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/server/tests/errors.test.ts
git -C /root/my/code-link commit -m "test: 添加 BusinessError 测试用例

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 创建 PermissionService

**Files:**
- Create: `packages/server/src/services/permission.service.ts`
- Create: `packages/server/tests/permission.service.test.ts`

- [ ] **Step 1: Write the failing test for PermissionService**

```typescript
// packages/server/tests/permission.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionService } from '../src/services/permission.service.js';
import { PermissionError, NotFoundError } from '../src/utils/errors.js';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService();
  });

  it('should throw PermissionError when user is not org member', async () => {
    await expect(service.checkOrgRole(99999, 1, 'member'))
      .rejects.toThrow(PermissionError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test tests/permission.service.test.ts`
Expected: FAIL - Cannot find module

- [ ] **Step 3: Create PermissionService**

```typescript
// packages/server/src/services/permission.service.ts
import { UserRepository } from '../repositories/user.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { PermissionError, NotFoundError } from '../utils/errors.js';
import type { OrgRole } from '../db/schema/index.js';
import type { SelectProject } from '../db/schema/index.js';

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

export class PermissionService {
  private userRepo = new UserRepository();
  private orgRepo = new OrganizationRepository();
  private projectRepo = new ProjectRepository();

  /**
   * 检查用户是否是超级管理员
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    const email = await this.userRepo.findEmailById(userId);
    return email ? isSuperAdmin(email) : false;
  }

  /**
   * 检查用户在组织中的角色
   * @throws PermissionError 如果用户无权限
   */
  async checkOrgRole(userId: number, orgId: number, minRole: OrgRole): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership) {
      throw new PermissionError('您不是该组织的成员');
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }
  }

  /**
   * 检查用户是否有项目访问权限
   * @returns 项目信息
   * @throws NotFoundError 如果项目不存在
   * @throws PermissionError 如果无权限
   */
  async checkProjectAccess(userId: number, projectId: number): Promise<SelectProject> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    if (await this.isSuperAdmin(userId)) {
      return project;
    }

    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      throw new PermissionError('您没有权限访问该项目');
    }

    return project;
  }

  /**
   * 检查用户是否是组织的 owner
   */
  async checkOrgOwner(userId: number, orgId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有组织 owner 可以执行此操作');
    }
  }

  /**
   * 检查用户是否可以创建组织
   */
  async checkCanCreateOrg(userId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const isOwner = await this.orgRepo.isOwnerOfAny(userId);
    if (!isOwner) {
      throw new PermissionError('只有组织 owner 或超级管理员可以创建组织');
    }
  }

  /**
   * 获取用户在组织中的角色（超管返回 'owner'）
   */
  async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
    if (await this.isSuperAdmin(userId)) {
      return 'owner';
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    return membership?.role ?? null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test tests/permission.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /root/my/code-link add packages/server/src/services/permission.service.ts packages/server/tests/permission.service.test.ts
git -C /root/my/code-link commit -m "feat: 创建 PermissionService 统一权限检查

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: 重构 OrganizationService 使用 PermissionService

**Files:**
- Modify: `packages/server/src/services/organization.service.ts`
- Test: `packages/server/tests/organization.service.test.ts` (如已存在则修改)

- [ ] **Step 1: 备份原文件并重构**

```typescript
// packages/server/src/services/organization.service.ts
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { PermissionService } from './permission.service.js';
import { NotFoundError, ParamError, ConflictError } from '../utils/errors.js';
import type {
  OrganizationWithRole,
  OrganizationMemberWithUser,
  OrganizationInvitationWithUser,
} from '../repositories/organization.repository.js';
import type { SelectOrganization, OrgRole } from '../db/schema/index.js';

export interface CreateOrganizationInput {
  name: string;
}

export interface UpdateOrganizationInput {
  name: string;
}

export interface InviteMemberInput {
  email: string;
  role: OrgRole;
}

export interface UpdateMemberRoleInput {
  userId: number;
  role: OrgRole;
}

export interface OrganizationDetail {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  members: OrganizationMemberWithUser[];
}

export class OrganizationService {
  private orgRepo = new OrganizationRepository();
  private userRepo = new UserRepository();
  private permService = new PermissionService();

  async create(userId: number, input: CreateOrganizationInput): Promise<SelectOrganization> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    await this.permService.checkCanCreateOrg(userId);
    return this.orgRepo.createWithOwner(trimmedName, userId);
  }

  async findByUserId(userId: number): Promise<OrganizationWithRole[]> {
    return this.orgRepo.findByUserId(userId);
  }

  async findById(orgId: number, userId: number): Promise<OrganizationDetail> {
    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new NotFoundError('组织');
    }

    await this.permService.checkOrgRole(userId, orgId, 'member');

    const members = await this.orgRepo.findMembers(orgId);
    return { ...org, members };
  }

  async updateName(orgId: number, userId: number, input: UpdateOrganizationInput): Promise<SelectOrganization> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('组织名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('组织名称不能超过 100 个字符');
    }

    await this.permService.checkOrgOwner(userId, orgId);
    return this.orgRepo.updateName(orgId, trimmedName);
  }

  async delete(orgId: number, userId: number): Promise<void> {
    await this.permService.checkOrgOwner(userId, orgId);

    const projectCount = await this.orgRepo.countProjects(orgId);
    if (projectCount > 0) {
      throw new ConflictError('组织下还有项目，请先删除或迁移项目');
    }

    await this.orgRepo.delete(orgId);
  }

  async updateMemberRole(orgId: number, userId: number, input: UpdateMemberRoleInput): Promise<OrganizationMemberWithUser> {
    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!validRoles.includes(input.role)) {
      throw new ParamError('无效的角色，必须是 owner、developer 或 member');
    }

    await this.permService.checkOrgOwner(userId, orgId);

    const targetMembership = await this.orgRepo.findUserMembership(orgId, input.userId);
    if (!targetMembership) {
      throw new NotFoundError('该用户不是组织成员');
    }

    if (targetMembership.role === 'owner' && input.role !== 'owner') {
      const ownerCount = await this.orgRepo.countOwners(orgId);
      if (ownerCount <= 1) {
        throw new ConflictError('不能修改最后一个 owner 的角色');
      }
    }

    await this.orgRepo.updateMemberRole(orgId, input.userId, input.role);

    const members = await this.orgRepo.findMembers(orgId);
    const updatedMember = members.find(m => m.userId === input.userId);
    if (!updatedMember) {
      throw new NotFoundError('成员');
    }

    return updatedMember;
  }

  async removeMember(orgId: number, userId: number, targetUserId: number): Promise<void> {
    await this.permService.checkOrgOwner(userId, orgId);

    if (targetUserId === userId) {
      throw new ConflictError('不能移除自己');
    }

    const targetMembership = await this.orgRepo.findUserMembership(orgId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('该用户不是组织成员');
    }

    if (targetMembership.role === 'owner') {
      const ownerCount = await this.orgRepo.countOwners(orgId);
      if (ownerCount <= 1) {
        throw new ConflictError('不能移除最后一个 owner');
      }
    }

    await this.orgRepo.removeMember(orgId, targetUserId);
  }

  async inviteMember(orgId: number, userId: number, input: InviteMemberInput): Promise<OrganizationInvitationWithUser> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!input.email || !emailRegex.test(input.email)) {
      throw new ParamError('邮箱地址格式不正确');
    }

    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!validRoles.includes(input.role)) {
      throw new ParamError('无效的角色，必须是 owner、developer 或 member');
    }

    await this.permService.checkOrgOwner(userId, orgId);

    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.orgRepo.findUserMembership(orgId, existingUser.id);
      if (existingMembership) {
        throw new ConflictError('该用户已是组织成员');
      }
    }

    const hasPending = await this.orgRepo.hasPendingInvitation(orgId, input.email);
    if (hasPending) {
      throw new ConflictError('该邮箱已有待处理的邀请');
    }

    await this.orgRepo.createInvitation({
      organizationId: orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      invitedBy: userId,
      status: 'pending',
    });

    const invitations = await this.orgRepo.findPendingInvitationsByOrg(orgId);
    const invitation = invitations.find(inv => inv.email === input.email.toLowerCase());
    if (!invitation) {
      throw new ConflictError('邀请创建失败');
    }

    return invitation;
  }

  async findPendingInvitations(orgId: number, userId: number): Promise<OrganizationInvitationWithUser[]> {
    await this.permService.checkOrgOwner(userId, orgId);
    return this.orgRepo.findPendingInvitationsByOrg(orgId);
  }

  async cancelInvitation(orgId: number, userId: number, invId: number): Promise<void> {
    await this.permService.checkOrgOwner(userId, orgId);
    await this.orgRepo.deleteInvitation(invId, orgId);
  }

  async findUserInvitations(userId: number): Promise<OrganizationInvitationWithUser[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户');
    }

    return this.orgRepo.findPendingInvitationsByEmail(user.email);
  }

  async acceptInvitation(userId: number, invId: number): Promise<{ organization: SelectOrganization; member: OrganizationMemberWithUser }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户');
    }

    const invitation = await this.orgRepo.findPendingInvitation(invId, user.email);
    if (!invitation) {
      throw new NotFoundError('邀请');
    }

    return this.orgRepo.acceptInvitationInTransaction(
      invId,
      invitation.organizationId,
      userId,
      invitation.role,
      invitation.invitedBy
    );
  }

  async declineInvitation(userId: number, invId: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户');
    }

    const result = await this.orgRepo.findPendingInvitation(invId, user.email);
    if (!result) {
      throw new NotFoundError('邀请');
    }

    await this.orgRepo.updateInvitationStatus(invId, 'declined');
  }
}
```

- [ ] **Step 2: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/server/src/services/organization.service.ts
git -C /root/my/code-link commit -m "refactor: OrganizationService 使用 PermissionService

移除重复的权限检查代码，统一使用 PermissionService

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: 重构 ProjectService 使用 PermissionService

**Files:**
- Modify: `packages/server/src/services/project.service.ts`

- [ ] **Step 1: 重构 ProjectService**

```typescript
// packages/server/src/services/project.service.ts
import { ProjectRepository } from '../repositories/project.repository.js';
import { PermissionService } from './permission.service.js';
import { NotFoundError, ParamError, ConflictError } from '../utils/errors.js';
import type { SelectProject, SelectProjectRepo, OrgRole } from '../db/schema/index.js';
import type { ProjectDetail, ProjectMemberWithUser } from '../repositories/project.repository.js';

export interface CreateProjectInput {
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  organizationId: number;
}

export interface AddRepoInput {
  url: string;
}

export class ProjectService {
  private projectRepo = new ProjectRepository();
  private permService = new PermissionService();

  async create(userId: number, input: CreateProjectInput): Promise<SelectProject> {
    if (!input.name || typeof input.name !== 'string' || input.name.length > 100) {
      throw new ParamError('项目名称必须是 1-100 字符的字符串');
    }

    const validTemplateTypes = ['node', 'node+java', 'node+python'];
    if (!validTemplateTypes.includes(input.templateType)) {
      throw new ParamError('无效的模板类型，必须是 node, node+java 或 node+python');
    }

    await this.permService.checkOrgRole(userId, input.organizationId, 'developer');

    return this.projectRepo.create({
      name: input.name,
      templateType: input.templateType,
      organizationId: input.organizationId,
      createdBy: userId,
    });
  }

  async findByUserId(userId: number, organizationId?: number): Promise<SelectProject[]> {
    return this.projectRepo.findByUserId(userId, organizationId);
  }

  async findById(userId: number, projectId: number): Promise<ProjectDetail> {
    const project = await this.permService.checkProjectAccess(userId, projectId);
    const members = await this.projectRepo.findProjectMembers(project.organizationId);
    const repos = await this.projectRepo.findRepos(projectId);

    return { ...project, members, repos };
  }

  async delete(userId: number, projectId: number): Promise<void> {
    const project = await this.permService.checkProjectAccess(userId, projectId);
    await this.permService.checkOrgOwner(userId, project.organizationId);
    await this.projectRepo.delete(projectId);
  }

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

  async isProjectMember(projectId: number, userId: number): Promise<boolean> {
    try {
      await this.permService.checkProjectAccess(userId, projectId);
      return true;
    } catch {
      return false;
    }
  }

  async findRepos(projectId: number, userId: number): Promise<SelectProjectRepo[]> {
    await this.permService.checkProjectAccess(userId, projectId);
    return this.projectRepo.findRepos(projectId);
  }

  async addRepo(projectId: number, userId: number, input: AddRepoInput): Promise<SelectProjectRepo> {
    await this.permService.checkProjectAccess(userId, projectId);

    const parsed = this.parseRepoUrl(input.url);
    if (!parsed) {
      throw new ParamError('无效的仓库 URL，仅支持 GitHub 和 GitLab');
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
        throw new ConflictError('该仓库已添加到项目中');
      }
      throw new Error('添加仓库失败');
    }
  }

  async deleteRepo(projectId: number, userId: number, repoId: number): Promise<void> {
    await this.permService.checkProjectAccess(userId, projectId);

    const repo = await this.projectRepo.findRepo(repoId, projectId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    await this.projectRepo.deleteRepo(repoId);
  }

  async updateRepoCloned(repoId: number, cloned: boolean): Promise<void> {
    await this.projectRepo.updateRepoCloned(repoId, cloned);
  }

  async getProjectForRepo(projectId: number, userId: number): Promise<SelectProject> {
    return this.permService.checkProjectAccess(userId, projectId);
  }
}
```

- [ ] **Step 2: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/server/src/services/project.service.ts
git -C /root/my/code-link commit -m "refactor: ProjectService 使用 PermissionService

移除重复的权限检查代码，统一使用 PermissionService

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: 重构 DraftService 使用 PermissionService

**Files:**
- Modify: `packages/server/src/services/draft.service.ts`

- [ ] **Step 1: 重构 DraftService**

```typescript
// packages/server/src/services/draft.service.ts
import { DraftRepository } from '../repositories/draft.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { PermissionService } from './permission.service.js';
import { NotFoundError, ParamError } from '../utils/errors.js';
import { isAICommand, parseAICommand, executeAICommand } from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';
import type { SelectDraft } from '../db/schema/index.js';
import type { DraftMemberWithUser, DraftMessageWithUser } from '../repositories/draft.repository.js';

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

export class DraftService {
  private draftRepo = new DraftRepository();
  private projectRepo = new ProjectRepository();
  private permService = new PermissionService();

  async create(userId: number, input: CreateDraftInput): Promise<SelectDraft> {
    if (!input.projectId || !input.title) {
      throw new ParamError('缺少必填字段：projectId, title');
    }

    if (typeof input.title !== 'string' || input.title.length > 200) {
      throw new ParamError('Draft 标题必须是 1-200 字符的字符串');
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    await this.permService.checkOrgRole(userId, project.organizationId, 'developer');

    const draft = await this.draftRepo.createWithOwner({
      projectId: input.projectId,
      title: input.title,
      createdBy: userId,
    }, userId);

    if (input.memberIds && input.memberIds.length > 0) {
      for (const memberId of input.memberIds) {
        if (memberId !== userId) {
          const isOrgMember = await this.permService.getOrgRole(memberId, project.organizationId);
          if (isOrgMember) {
            await this.draftRepo.addMember({
              draftId: draft.id,
              userId: memberId,
              role: 'participant',
            });
          }
        }
      }
    }

    return draft;
  }

  async findByUserId(userId: number): Promise<SelectDraft[]> {
    return this.draftRepo.findByUserId(userId);
  }

  async findById(draftId: number, userId: number): Promise<{ draft: SelectDraft; members: DraftMemberWithUser[] }> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('Draft');
    }

    const members = await this.draftRepo.findMembers(draftId);
    return { draft, members };
  }

  async updateStatus(draftId: number, userId: number, status: string): Promise<SelectDraft> {
    const validStatuses = ['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new ParamError('无效的状态值');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    return this.draftRepo.updateStatus(draftId, status);
  }

  async delete(draftId: number, userId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有 Draft owner 可以删除 Draft');
    }

    await this.draftRepo.delete(draftId);
  }

  async isMember(draftId: number, userId: number): Promise<boolean> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    return !!membership;
  }

  async isOwner(draftId: number, userId: number): Promise<boolean> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    return membership?.role === 'owner';
  }

  async createMessage(draftId: number, userId: number, input: { content: string; messageType?: string; parentId?: number; metadata?: string }): Promise<DraftMessageWithUser> {
    if (!input.content) {
      throw new ParamError('参数无效');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    const message = await this.draftRepo.createMessage({
      draftId,
      parentId: input.parentId || null,
      userId,
      content: input.content,
      messageType: (input.messageType || 'text') as 'text' | 'image' | 'code' | 'document_card' | 'ai_command' | 'system' | 'ai_response' | 'ai_error',
      metadata: input.metadata || null,
    });

    await this.draftRepo.touch(draftId);

    const user = await this.permService['userRepo'].findById(userId);
    return {
      ...message,
      userName: user?.name || 'Unknown',
    };
  }

  async findMessages(draftId: number, userId: number, options?: { parentId?: number | null; before?: string; limit?: number }): Promise<DraftMessageWithUser[]> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    return this.draftRepo.findMessages(draftId, options || {});
  }

  async confirmMessage(draftId: number, messageId: number, userId: number, input: { type: string; comment?: string }): Promise<{ userId: number; userName: string; type: string }> {
    const validTypes = ['agree', 'disagree', 'suggest'];
    if (!validTypes.includes(input.type)) {
      throw new ParamError('type 必须是 agree, disagree 或 suggest');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    const message = await this.draftRepo.findMessage(messageId, draftId);
    if (!message) {
      throw new NotFoundError('消息');
    }

    await this.draftRepo.upsertConfirmation({
      messageId,
      userId,
      type: input.type as 'agree' | 'disagree' | 'suggest',
      comment: input.comment || null,
    });

    const user = await this.permService['userRepo'].findById(userId);
    return {
      userId,
      userName: user?.name || 'Unknown',
      type: input.type,
    };
  }

  async findConfirmations(draftId: number, messageId: number, userId: number) {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    return this.draftRepo.findConfirmations(messageId);
  }

  async addMember(draftId: number, userId: number, newUserId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有 Draft owner 可以添加成员');
    }

    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('Draft');
    }

    const project = await this.projectRepo.findById(draft.projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    const isOrgMember = await this.permService.getOrgRole(newUserId, project.organizationId);
    if (!isOrgMember) {
      throw new PermissionError('用户不是项目所属组织的成员');
    }

    await this.draftRepo.addMember({
      draftId,
      userId: newUserId,
      role: 'participant',
    });
  }

  async removeMember(draftId: number, userId: number, memberId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有 Draft owner 可以移除成员');
    }

    const targetMembership = await this.draftRepo.findMember(draftId, memberId);
    if (!targetMembership) {
      throw new NotFoundError('成员');
    }

    if (targetMembership.role === 'owner') {
      throw new PermissionError('无法移除 Draft owner');
    }

    await this.draftRepo.removeMember(draftId, memberId);
  }

  async getProjectId(draftId: number): Promise<number | null> {
    const draft = await this.draftRepo.findById(draftId);
    return draft?.projectId || null;
  }

  async handleAICommand(
    draftId: number,
    userId: number,
    content: string,
    parentMessageId?: number
  ): Promise<{ success: boolean; message?: DraftMessageWithUser; error?: string }> {
    if (!isAIEnabled()) {
      return {
        success: false,
        error: 'AI 功能未启用。请配置 ANTHROPIC_API_KEY。',
      };
    }

    const command = parseAICommand(content);
    if (!command) {
      return {
        success: false,
        error: '无法解析 AI 命令',
      };
    }

    try {
      const aiResult = await executeAICommand(draftId, command, userId);

      const aiResponseContent = aiResult.success
        ? aiResult.response
        : `AI 命令执行失败: ${aiResult.error}`;

      const aiMessage = await this.createMessage(draftId, 0, {
        content: aiResponseContent || '',
        messageType: aiResult.success ? 'ai_response' : 'ai_error',
        parentId: parentMessageId,
        metadata: JSON.stringify({ commandType: command.type }),
      });

      return {
        success: aiResult.success,
        message: aiMessage,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 命令执行失败',
      };
    }
  }

  checkIsAICommand(content: string): boolean {
    return isAICommand(content);
  }
}
```

- [ ] **Step 2: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/server/src/services/draft.service.ts
git -C /root/my/code-link commit -m "refactor: DraftService 使用 PermissionService

移除重复的权限检查代码，统一使用 PermissionService

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: 重构 AuthService 使用 BusinessError

**Files:**
- Modify: `packages/server/src/services/auth.service.ts`

- [ ] **Step 1: 重构 AuthService**

```typescript
// packages/server/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { AuthError, ConflictError } from '../utils/errors.js';
import type { SelectUser } from '../db/schema/index.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: Omit<SelectUser, 'passwordHash'>;
}

export class AuthService {
  private userRepo = new UserRepository();

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(data.email);

    if (!user || !bcrypt.compareSync(data.password, user.passwordHash)) {
      throw new AuthError('邮箱或密码错误');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async getUser(userId: number): Promise<Omit<SelectUser, 'passwordHash'> | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: SelectUser): Omit<SelectUser, 'passwordHash'> {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
```

- [ ] **Step 2: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/server/src/services/auth.service.ts
git -C /root/my/code-link commit -m "refactor: AuthService 使用 BusinessError

统一错误类型，移除字符串错误

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: 简化数据库初始化 - 删除 raw SQL schema

**Files:**
- Modify: `packages/server/src/db/init.ts`
- Modify: `packages/server/src/db/index.ts`
- Delete: `packages/server/src/db/schema.ts` (raw SQL version)

- [ ] **Step 1: 简化 db/init.ts**

```typescript
// packages/server/src/db/init.ts
import bcrypt from 'bcryptjs';
import { getDb } from './drizzle.js';
import { users } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../logger/index.js';
import type Database from 'better-sqlite3';

const logger = createLogger('db-init');

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

/**
 * 初始化数据库 Schema
 * 使用 Drizzle push 或 migrate 命令创建表结构
 * 此函数仅用于兼容旧代码，建议使用 drizzle-kit push
 */
export function initSchema(_db: Database.Database): void {
  logger.info('initSchema is deprecated. Use drizzle-kit push instead.');
}

/**
 * 初始化默认超级管理员账号
 */
export async function initDefaultAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || 'test_123';

  const db = getDb();
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).get();

  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    await db.insert(users).values({
      name: 'Admin',
      email: adminEmail,
      passwordHash,
    }).returning().get();
    logger.info(`Default admin created: ${adminEmail}`);
  }
}
```

- [ ] **Step 2: 简化 db/index.ts**

```typescript
// packages/server/src/db/index.ts
// Drizzle ORM 客户端
export { getDb, getSqliteDb, closeDb } from './drizzle.js';

// Schema 定义
export * from './schema/index.js';

// 初始化
export { initDefaultAdmin } from './init.js';
```

- [ ] **Step 3: 删除 raw SQL schema 文件**

Run: `rm -f /root/my/code-link/packages/server/src/db/schema.ts`

- [ ] **Step 4: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /root/my/code-link add packages/server/src/db/init.ts packages/server/src/db/index.ts
git -C /root/my/code-link commit -m "refactor: 简化数据库初始化

移除 raw SQL schema，统一使用 Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: 删除冗余的 types.ts，统一使用 Drizzle 类型

**Files:**
- Delete: `packages/server/src/types.ts`
- Modify: 检查所有引用 types.ts 的文件并更新导入

- [ ] **Step 1: 查找所有引用 types.ts 的文件**

Run: `grep -r "from './types.js'" /root/my/code-link/packages/server/src/ || true`
Run: `grep -r 'from "../types.js"' /root/my/code-link/packages/server/src/ || true`

- [ ] **Step 2: 分析 types.ts 中需要保留的类型**

检查 types.ts 内容，确认哪些类型需要迁移到 schema：
- `ContainerInfo` - 保留，这是业务概念，不是数据库类型
- `User`, `Project`, `Organization` 等 - 已在 schema 中定义，删除
- `OrgRole` - 已在 schema 中定义

- [ ] **Step 3: 创建 types/business.ts 保存非数据库类型**

```typescript
// packages/server/src/types/business.ts
import { TemplateType } from '../docker/templates.js';

export interface ContainerInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'created';
  projectId: number;
  templateType: TemplateType;
  volumePath: string;
}
```

- [ ] **Step 4: 更新导入引用**

更新所有从 types.ts 导入的文件，改为从 schema/index.ts 导入。

- [ ] **Step 5: 删除 types.ts**

Run: `rm -f /root/my/code-link/packages/server/src/types.ts`

- [ ] **Step 6: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "refactor: 删除冗余的 types.ts

统一使用 Drizzle schema 导出的类型

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: 更新路由使用 handleRouteError

**Files:**
- Modify: `packages/server/src/routes/*.ts`

- [ ] **Step 1: 重构 routes/projects.ts 使用 handleRouteError**

```typescript
// packages/server/src/routes/projects.ts
import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { success, handleRouteError } from '../utils/response.js';

const logger = createLogger('projects');

export function createProjectsRouter(): Router {
  const router = Router();
  const projectService = new ProjectService();

  router.post('/', authMiddleware, async (req, res) => {
    try {
      const project = await projectService.create(req.userId!, req.body);
      res.status(201).json(success(project));
    } catch (error) {
      handleRouteError(res, error, logger, '创建项目失败');
    }
  });

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string, 10) : undefined;
      const projects = await projectService.findByUserId(req.userId!, organizationId);
      res.json(success(projects));
    } catch (error) {
      handleRouteError(res, error, logger, '获取项目列表失败');
    }
  });

  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ code: 20002, error: '项目 ID 无效' });
        return;
      }
      const project = await projectService.findById(req.userId!, projectId);
      res.json(success(project));
    } catch (error) {
      handleRouteError(res, error, logger, '获取项目详情失败');
    }
  });

  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ code: 20002, error: '项目 ID 无效' });
        return;
      }
      await projectService.delete(req.userId!, projectId);
      res.status(204).send();
    } catch (error) {
      handleRouteError(res, error, logger, '删除项目失败');
    }
  });

  return router;
}
```

- [ ] **Step 2: 同样重构其他路由文件**

按照相同模式重构：
- `routes/auth.ts`
- `routes/organizations.ts`
- `routes/drafts.ts`
- `routes/builds.ts`
- `routes/repos.ts`
- `routes/containers.ts`
- `routes/claude-config.ts`

- [ ] **Step 3: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git -C /root/my/code-link add packages/server/src/routes/
git -C /root/my/code-link commit -m "refactor: 路由统一使用 handleRouteError

移除字符串匹配的错误处理，使用 BusinessError

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: 简化中间件权限检查

**Files:**
- Modify: `packages/server/src/middleware/auth.ts`
- Modify: `packages/server/src/middleware/permission.ts` (如果存在)

- [ ] **Step 1: 重构 middleware/auth.ts 使用 PermissionService**

```typescript
// packages/server/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../logger/index.js';
import { PermissionService } from '../services/permission.service.js';
import { AuthError, PermissionError } from '../utils/errors.js';
import { handleRouteError } from '../utils/response.js';
import type { OrgRole } from '../db/schema/index.js';

const logger = createLogger('auth');

const DEFAULT_SECRET = 'code-link-dev-secret';

if (!process.env.JWT_SECRET) {
  logger.warn('Using default JWT_SECRET. Set JWT_SECRET in production!');
}

export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

const permService = new PermissionService();

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ code: 30001, error: '请先登录' });
    return;
  }

  const token = header.slice(7);
  if (!token) {
    res.status(401).json({ code: 30001, error: '请先登录' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
      res.status(401).json({ code: 30001, error: '请先登录' });
      return;
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    res.status(401).json({ code: 30001, error: '请先登录' });
  }
}

/**
 * 创建组织权限检查中间件
 */
export function createOrgMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      const orgIdParam = req.params.orgId || req.params.id || req.body.organization_id;
      const orgId = parseInt(orgIdParam || '', 10);

      if (!userId) {
        res.status(401).json({ code: 30001, error: '请先登录' });
        return;
      }

      if (isNaN(orgId)) {
        res.status(400).json({ code: 20002, error: '组织 ID 无效' });
        return;
      }

      await permService.checkOrgRole(userId, orgId, minRole);
      req.orgRole = await permService.getOrgRole(userId, orgId) || undefined;
      next();
    } catch (error) {
      handleRouteError(res, error, logger, '权限检查失败');
    }
  };
}

/**
 * 创建项目权限检查中间件
 */
export function createProjectMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      const projectIdParam = req.params.id || req.params.projectId;
      const projectId = parseInt(projectIdParam || '', 10);

      if (!userId) {
        res.status(401).json({ code: 30001, error: '请先登录' });
        return;
      }

      if (isNaN(projectId)) {
        res.status(400).json({ code: 20002, error: '项目 ID 无效' });
        return;
      }

      const project = await permService.checkProjectAccess(userId, projectId);
      const role = await permService.getOrgRole(userId, project.organizationId);
      
      const ROLE_HIERARCHY: Record<OrgRole, number> = {
        owner: 3,
        developer: 2,
        member: 1,
      };

      if (role && ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
        throw new PermissionError(`需要 ${minRole} 或更高权限`);
      }

      next();
    } catch (error) {
      handleRouteError(res, error, logger, '权限检查失败');
    }
  };
}

/**
 * 检查用户是否有权创建组织
 */
export function createCanCreateOrgMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ code: 30001, error: '请先登录' });
        return;
      }

      await permService.checkCanCreateOrg(userId);
      next();
    } catch (error) {
      handleRouteError(res, error, logger, '权限检查失败');
    }
  };
}
```

- [ ] **Step 2: Run tests to verify**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git -C /root/my/code-link add packages/server/src/middleware/auth.ts
git -C /root/my/code-link commit -m "refactor: 中间件使用 PermissionService

统一权限检查逻辑，移除重复代码

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: 运行所有测试验证重构

**Files:**
- 无文件修改

- [ ] **Step 1: 运行服务端所有单元测试**

Run: `cd /root/my/code-link && pnpm --filter @code-link/server test`
Expected: PASS

- [ ] **Step 2: 运行 E2E 测试**

Run: `cd /root/my/code-link && pnpm test:e2e`
Expected: PASS

- [ ] **Step 3: 手动测试关键功能**

1. 启动服务器: `pnpm dev:server`
2. 测试登录注册
3. 测试创建组织
4. 测试创建项目
5. 测试创建 Draft

---

### Task 12: 提交最终变更

**Files:**
- 所有变更文件

- [ ] **Step 1: 确认所有变更已提交**

Run: `git -C /root/my/code-link status`

- [ ] **Step 2: 如果有未提交的变更，提交它们**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "refactor(server): 后端架构大重构完成

- 创建 PermissionService 统一权限检查
- 重构所有 Service 使用 BusinessError
- 简化数据库初始化，移除 raw SQL
- 删除冗余的 types.ts，统一使用 Drizzle 类型
- 路由统一使用 handleRouteError

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 3: 查看最终提交历史**

Run: `git -C /root/my/code-link log --oneline -10`

---

## 完成标准

- [ ] 所有单元测试通过
- [ ] 所有 E2E 测试通过
- [ ] 无 TypeScript 编译错误
- [ ] 代码风格一致
- [ ] 每个 Service 方法都使用 BusinessError
- [ ] 每个 Route 都使用 handleRouteError
- [ ] types.ts 已删除
- [ ] raw SQL schema 已删除
