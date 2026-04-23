import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { ProjectRepository } from './repository.js';
import { OrganizationService } from '../organization/organization.module.js';
import { PermissionService } from '../../shared/permission.service.js';
import { ParamError, NotFoundError } from '../../core/errors/index.js';
import type { SelectProject, SelectProjectRepo } from '../../db/schema/index.js';
import type { PaginatedResult } from '../../core/database/pagination.js';
import { isValidTemplate } from '../container/lib/templates.js';
import type { CreateProjectInput, AddRepoInput } from './schemas.js';
import type { ProjectDetail, ParsedRepoUrl } from './types.js';

@singleton()
export class ProjectService {
  constructor(
    @inject(ProjectRepository) private readonly repo: ProjectRepository,
    @inject(OrganizationService) private readonly orgService: OrganizationService,
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}

  async create(userId: number, input: CreateProjectInput): Promise<SelectProject> {
    const trimmedName = input.name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new ParamError('项目名称必须是 1-100 字符');
    }

    if (!isValidTemplate(input.templateType)) {
      throw new ParamError('无效的模板类型，必须是 node, node+java 或 node+python');
    }

    const role = await this.orgService.getOrgRole(userId, input.organizationId);
    await this.permService.requireOrgRole(userId, role, 'developer');

    return this.repo.create({
      name: trimmedName,
      templateType: input.templateType,
      organizationId: input.organizationId,
      createdBy: userId,
    });
  }

  async findByUserId(userId: number, organizationId?: number, page?: number, limit?: number): Promise<PaginatedResult<SelectProject>> {
    return this.repo.findByUserId(userId, organizationId, page, limit);
  }

  async findById(userId: number, projectId: number): Promise<ProjectDetail> {
    const project = await this.repo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);
    const members = await this.repo.findProjectMembers(project.organizationId);
    const repos = await this.repo.findRepos(projectId);

    return { ...project, members, repos };
  }

  async delete(userId: number, projectId: number): Promise<void> {
    const project = await this.repo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);
    await this.permService.requireOrgOwner(userId, role);
    await this.repo.delete(projectId);
  }

  parseRepoUrl(url: string): ParsedRepoUrl | null {
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
      const project = await this.repo.findById(projectId);
      if (!project) return false;

      const role = await this.orgService.getOrgRole(userId, project.organizationId);
      await this.permService.requireProjectAccess(userId, role);
      return true;
    } catch {
      return false;
    }
  }

  async findRepos(projectId: number, userId: number): Promise<SelectProjectRepo[]> {
    const project = await this.repo.findById(projectId);
    if (!project) throw new NotFoundError('项目');

    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);
    return this.repo.findRepos(projectId);
  }

  async addRepo(projectId: number, userId: number, input: AddRepoInput): Promise<SelectProjectRepo> {
    const project = await this.repo.findById(projectId);
    if (!project) throw new NotFoundError('项目');

    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);

    const parsed = this.parseRepoUrl(input.url);
    if (!parsed) {
      throw new ParamError('无效的仓库 URL，仅支持 GitHub 和 GitLab');
    }

    try {
      return await this.repo.addRepo({
        projectId,
        provider: parsed.provider,
        repoUrl: input.url,
        repoName: parsed.repoName,
      });
    } catch (error: unknown) {
      const sqliteError = error as { code?: string };
      if (sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' || sqliteError.code === 'SQLITE_CONSTRAINT') {
        throw new ParamError('该仓库已添加到项目中');
      }
      throw error;
    }
  }

  async deleteRepo(projectId: number, userId: number, repoId: number): Promise<void> {
    const project = await this.repo.findById(projectId);
    if (!project) throw new NotFoundError('项目');

    const role = await this.orgService.getOrgRole(userId, project.organizationId);
    await this.permService.requireProjectAccess(userId, role);

    const repo = await this.repo.findRepo(repoId, projectId);
    if (!repo) {
      throw new ParamError('仓库不存在');
    }

    await this.repo.deleteRepo(repoId);
  }

  async getProjectById(projectId: number): Promise<SelectProject | null> {
    const project = await this.repo.findById(projectId);
    return project ?? null;
  }

  async updateStatus(projectId: number, status: 'created' | 'running' | 'stopped'): Promise<SelectProject> {
    return this.repo.updateStatus(projectId, status);
  }

  async updateContainerId(projectId: number, containerId: string | null): Promise<SelectProject> {
    return this.repo.updateContainerId(projectId, containerId);
  }
}