// packages/server/src/routes/repos.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { RepoManager } from '../git/repo-manager.js';
import { ProjectRepository, UserRepository, OrganizationRepository } from '../repositories/index.js';
import { success, Errors } from '../utils/response.js';

const logger = createLogger('repos');

export function createReposRouter(): Router {
  const router = Router({ mergeParams: true });
  const projectRepo = new ProjectRepository();
  const userRepo = new UserRepository();
  const orgRepo = new OrganizationRepository();
  const repoManager = new RepoManager();

  // 解析仓库 URL
  function parseRepoUrl(url: string): { provider: 'github' | 'gitlab'; repoName: string } | null {
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

      // 提取仓库名：/owner/repo.git 或 /owner/repo
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

  // GET / - 获取项目的仓库列表
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectIdStr = req.params.projectId;
    const projectId = parseInt(typeof projectIdStr === 'string' ? projectIdStr : projectIdStr[0], 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查用户是否是项目所属组织的成员
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    const repos = await projectRepo.findRepos(projectId);
    res.json(success(repos));
  });

  // POST / - 添加仓库到项目
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectIdStr = req.params.projectId;
    const projectId = parseInt(typeof projectIdStr === 'string' ? projectIdStr : projectIdStr[0], 10);
    const { url } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json(Errors.paramMissing('仓库 URL'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查用户是否是项目所属组织的成员
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 解析 URL
    const parsed = parseRepoUrl(url);
    if (!parsed) {
      res.status(400).json(Errors.paramInvalid('仓库 URL', '仅支持 GitHub 和 GitLab'));
      return;
    }

    try {
      const repo = await projectRepo.addRepo({
        projectId,
        provider: parsed.provider,
        repoUrl: url,
        repoName: parsed.repoName,
      });
      res.status(201).json(success(repo));
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json(Errors.conflict('该仓库已添加到项目中'));
        return;
      }
      logger.error('添加仓库失败', error);
      res.status(500).json(Errors.internal('添加仓库失败'));
    }
  });

  // POST /import - 导入仓库并克隆到容器
  router.post('/import', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectIdStr = req.params.projectId;
    const projectId = parseInt(typeof projectIdStr === 'string' ? projectIdStr : projectIdStr[0], 10);
    const { repoUrl, branch, containerId } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json(Errors.paramMissing('仓库 URL'));
      return;
    }

    if (!containerId || typeof containerId !== 'string') {
      res.status(400).json(Errors.paramMissing('容器 ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查用户是否是项目所属组织的成员
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 解析 URL
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      res.status(400).json(Errors.paramInvalid('仓库 URL', '仅支持 GitHub 和 GitLab'));
      return;
    }

    try {
      // 1. 添加仓库记录（标记为已克隆）
      const repo = await projectRepo.addRepo({
        projectId,
        provider: parsed.provider,
        repoUrl,
        repoName: parsed.repoName,
        branch: branch || 'main',
        cloned: true,
      });

      // 2. 克隆到容器
      const cloneResult = await repoManager.cloneRepo(
        containerId,
        projectId,
        repoUrl,
        userId
      );

      if (!cloneResult.success) {
        // 克隆失败，删除数据库记录
        await projectRepo.deleteRepo(repo.id);
        res.status(500).json(Errors.internal(cloneResult.error || '克隆仓库失败'));
        return;
      }

      res.status(201).json(success({ ...repo, path: cloneResult.path }));
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json(Errors.conflict('该仓库已添加到项目中'));
        return;
      }
      logger.error('导入仓库失败', error);
      res.status(500).json(Errors.internal('导入仓库失败'));
    }
  });

  // DELETE /:repoId - 删除仓库
  router.delete('/:repoId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectIdStr = req.params.projectId;
    const projectId = parseInt(typeof projectIdStr === 'string' ? projectIdStr : projectIdStr[0], 10);
    const repoIdStr = req.params.repoId;
    const repoId = parseInt(typeof repoIdStr === 'string' ? repoIdStr : repoIdStr[0], 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查用户是否是项目所属组织的成员
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查仓库是否属于该项目
    const repo = await projectRepo.findRepo(repoId, projectId);
    if (!repo) {
      res.status(404).json(Errors.notFound('仓库'));
      return;
    }

    await projectRepo.deleteRepo(repoId);
    res.status(204).send();
  });

  // POST /:repoId/clone - Clone 仓库（仅 owner）
  router.post('/:repoId/clone', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectIdStr = req.params.projectId;
    const projectId = parseInt(typeof projectIdStr === 'string' ? projectIdStr : projectIdStr[0], 10);
    const repoIdStr = req.params.repoId;
    const repoId = parseInt(typeof repoIdStr === 'string' ? repoIdStr : repoIdStr[0], 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查用户是否是项目所属组织的 owner
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership || membership.role !== 'owner') {
      res.status(403).json(Errors.forbidden());
      return;
    }

    // 获取仓库信息
    const repo = await projectRepo.findRepo(repoId, projectId);
    if (!repo) {
      res.status(404).json(Errors.notFound('仓库'));
      return;
    }

    if (!project.containerId) {
      res.status(400).json(Errors.paramInvalid('容器', '项目容器未启动'));
      return;
    }

    try {
      const result = await repoManager.cloneRepo(
        project.containerId,
        projectId,
        repo.repoUrl,
        userId
      );

      if (!result.success) {
        res.status(500).json(Errors.internal(result.error || 'Clone 失败'));
        return;
      }

      // 更新 cloned 状态
      await projectRepo.updateRepoCloned(repoId, true);

      res.json(success({ path: result.path }));
    } catch (error) {
      logger.error('Clone 失败', error);
      res.status(500).json(Errors.internal('Clone 失败'));
    }
  });

  // POST /:repoId/push - Push 仓库（仅 owner）
  router.post('/:repoId/push', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectIdStr = req.params.projectId;
    const projectId = parseInt(typeof projectIdStr === 'string' ? projectIdStr : projectIdStr[0], 10);
    const repoIdStr = req.params.repoId;
    const repoId = parseInt(typeof repoIdStr === 'string' ? repoIdStr : repoIdStr[0], 10);
    const { message } = req.body;

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json(Errors.paramInvalid('ID'));
      return;
    }

    if (!message || typeof message !== 'string') {
      res.status(400).json(Errors.paramMissing('commit message'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    // 检查用户是否是项目所属组织的 owner
    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership || membership.role !== 'owner') {
      res.status(403).json(Errors.forbidden());
      return;
    }

    // 获取仓库信息
    const repo = await projectRepo.findRepo(repoId, projectId);
    if (!repo) {
      res.status(404).json(Errors.notFound('仓库'));
      return;
    }

    if (!project.containerId) {
      res.status(400).json(Errors.paramInvalid('容器', '项目容器未启动'));
      return;
    }

    // 获取用户信息
    const user = await userRepo.findById(userId);
    if (!user) {
      res.status(500).json(Errors.internal('用户信息不存在'));
      return;
    }

    try {
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
        res.status(500).json(Errors.internal(result.error || 'Push 失败'));
        return;
      }

      res.json(success({ success: true }));
    } catch (error) {
      logger.error('Push 失败', error);
      res.status(500).json(Errors.internal('Push 失败'));
    }
  });

  return router;
}