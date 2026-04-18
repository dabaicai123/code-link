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