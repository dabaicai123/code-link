import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { createProjectContainer, startContainer, stopContainer, removeContainer, getContainerStatus, getProjectContainer } from '../docker/container-manager.js';
import { createProjectVolume, removeProjectVolume } from '../docker/volume-manager.js';
import { ProjectRepository, ClaudeConfigRepository, OrganizationRepository } from '../repositories/index.js';

const logger = createLogger('containers');

export function createContainersRouter(): Router {
  const router = Router();
  const projectRepo = new ProjectRepository();
  const claudeConfigRepo = new ClaudeConfigRepository();
  const orgRepo = new OrganizationRepository();

  // POST /api/projects/:id/container/start - 启动容器
  router.post('/:id/container/start', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 获取项目信息
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目所属组织的成员
    if (project.organizationId) {
      const membership = await orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }
    }

    try {
      // 检查用户是否配置了 Claude Code
      const configRow = await claudeConfigRepo.findByUserId(userId);

      if (!configRow) {
        res.status(400).json({
          error: '请先在「设置 → Claude Code 配置」中完成配置后再启动容器',
          code: 'CLAUDE_CONFIG_MISSING'
        });
        return;
      }

      let containerId = project.containerId;

      // 如果容器不存在，创建容器
      if (!containerId) {
        // 创建持久化卷
        await createProjectVolume(projectId);

        // 创建容器
        containerId = await createProjectContainer(projectId, project.templateType, `/workspace/project-${projectId}`);

        // 更新项目的 container_id
        await projectRepo.updateContainerId(projectId, containerId);
      }

      // 启动容器
      await startContainer(containerId);

      // 获取容器状态
      const status = await getContainerStatus(containerId);

      // 更新项目状态
      await projectRepo.updateStatus(projectId, 'running');

      res.json({ container_id: containerId, status });
    } catch (error) {
      logger.error('启动容器失败', error);
      res.status(500).json({ error: '启动容器失败' });
    }
  });

  // POST /api/projects/:id/container/stop - 停止容器
  router.post('/:id/container/stop', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 获取项目信息
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目所属组织的成员
    if (project.organizationId) {
      const membership = await orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }
    }

    if (!project.containerId) {
      res.status(400).json({ error: '项目没有关联的容器' });
      return;
    }

    try {
      // 先检查容器状态，如果已经停止则跳过
      const currentStatus = await getContainerStatus(project.containerId);
      if (currentStatus === 'running') {
        await stopContainer(project.containerId);
      }

      // 获取容器状态
      const status = await getContainerStatus(project.containerId);

      // 更新项目状态
      await projectRepo.updateStatus(projectId, 'stopped');

      res.json({ container_id: project.containerId, status });
    } catch (error) {
      logger.error('停止容器失败', error);
      res.status(500).json({ error: '停止容器失败' });
    }
  });

  // GET /api/projects/:id/container - 获取容器状态
  router.get('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 获取项目信息
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目所属组织的成员
    if (project.organizationId) {
      const membership = await orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }
    }

    if (!project.containerId) {
      res.status(404).json({ error: '容器不存在' });
      return;
    }

    try {
      // 获取容器状态
      const status = await getContainerStatus(project.containerId);
      res.json({ container_id: project.containerId, status });
    } catch (error) {
      logger.error('获取容器状态失败', error);
      res.status(500).json({ error: '获取容器状态失败' });
    }
  });

  // DELETE /api/projects/:id/container - 删除容器和卷
  router.delete('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 获取项目信息
    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查用户是否是项目所属组织的 owner
    if (project.organizationId) {
      const membership = await orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有项目 owner 可以删除容器' });
        return;
      }
    }

    try {
      // 删除容器
      if (project.containerId) {
        await removeContainer(project.containerId);
      }

      // 删除卷
      await removeProjectVolume(projectId);

      // 更新项目状态
      await projectRepo.updateContainerId(projectId, null);
      await projectRepo.updateStatus(projectId, 'created');

      res.status(204).send();
    } catch (error) {
      logger.error('删除容器失败', error);
      res.status(500).json({ error: '删除容器失败' });
    }
  });

  return router;
}