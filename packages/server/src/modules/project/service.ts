import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { ProjectRepository } from './repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { NotFoundError, ParamError, ConflictError } from '../../core/errors/index.js';
import type { SelectProject, SelectProjectRepo } from '../../db/schema/index.js';
import type { ProjectMemberWithUser } from './types.js';

export interface CreateProjectInput {
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  organizationId: number;
}

export interface AddRepoInput {
  url: string;
}

export interface ProjectDetail extends SelectProject {
  members: ProjectMemberWithUser[];
  repos: SelectProjectRepo[];
}

@singleton()
export class ProjectService {
  constructor(
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}

  /**
   * 创建项目
   */
  async create(userId: number, input: CreateProjectInput): Promise<SelectProject> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ParamError('项目名称不能为空');
    }
    if (trimmedName.length > 100) {
      throw new ParamError('项目名称不能超过 100 个字符');
    }

    const validTemplateTypes = ['node', 'node+java', 'node+python'];
    if (!validTemplateTypes.includes(input.templateType)) {
      throw new ParamError('无效的模板类型，必须是 node, node+java 或 node+python');
    }

    // 检查用户是否有权在该组织创建项目 (需要 developer 或更高权限)
    await this.permService.checkOrgRole(userId, input.organizationId, 'developer');

    return this.projectRepo.create({
      name: trimmedName,
      templateType: input.templateType,
      organizationId: input.organizationId,
      createdBy: userId,
    });
  }

  /**
   * 获取用户参与的所有项目
   */
  async findByUserId(userId: number, organizationId?: number): Promise<SelectProject[]> {
    return this.projectRepo.findByUserId(userId, organizationId);
  }

  /**
   * 获取项目详情
   */
  async findById(userId: number, projectId: number): Promise<ProjectDetail> {
    const project = await this.permService.checkProjectAccess(userId, projectId);
    const members = await this.projectRepo.findProjectMembers(project.organizationId);
    const repos = await this.projectRepo.findRepos(projectId);

    return { ...project, members, repos };
  }

  /**
   * 删除项目
   */
  async delete(userId: number, projectId: number): Promise<void> {
    const project = await this.permService.checkProjectAccess(userId, projectId);
    // 只有组织 owner 可以删除项目
    await this.permService.checkOrgOwner(userId, project.organizationId);
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
    try {
      await this.permService.checkProjectAccess(userId, projectId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取项目仓库列表
   */
  async findRepos(projectId: number, userId: number): Promise<SelectProjectRepo[]> {
    await this.permService.checkProjectAccess(userId, projectId);
    return this.projectRepo.findRepos(projectId);
  }

  /**
   * 添加仓库到项目
   */
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

  /**
   * 删除仓库
   */
  async deleteRepo(projectId: number, userId: number, repoId: number): Promise<void> {
    await this.permService.checkProjectAccess(userId, projectId);

    const repo = await this.projectRepo.findRepo(repoId, projectId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    await this.projectRepo.deleteRepo(repoId);
  }
}