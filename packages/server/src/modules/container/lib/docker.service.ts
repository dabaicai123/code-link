import { singleton } from 'tsyringe';
import Docker from 'dockerode';
import type { DockerOptions } from 'dockerode';
import { createLogger } from '../../../core/logger/index.js';
import { getConfig } from '../../../core/config.js';
import { ensureTemplateImage, getTemplateConfig, TemplateType } from './templates.js';
import type { IDockerService } from '../../../core/interfaces/index.js';

const logger = createLogger('docker-service');
const CONTAINER_NAME_PREFIX = process.env.NODE_ENV === 'test' ? 'test_code-link-project-' : 'code-link-project-';
const VOLUME_NAME_PREFIX = process.env.NODE_ENV === 'test' ? 'test_code-link-project-' : 'code-link-project-';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

@singleton()
export class DockerService implements IDockerService {
  private client: Docker;

  constructor() {
    const config = getConfig();
    const dockerOptions: DockerOptions = {};
    if (config.dockerHost) {
      dockerOptions.host = config.dockerHost;
      if (config.dockerPort) dockerOptions.port = config.dockerPort;
    }
    this.client = new Docker(dockerOptions);
  }

  async createProjectContainer(
    projectId: number,
    templateType: TemplateType,
    volumePath: string
  ): Promise<string> {
    const config = getTemplateConfig(templateType);
    await ensureTemplateImage(this.client, templateType);

    const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

    try {
      const existing = await this.client.getContainer(containerName).inspect();
      return existing.Id;
    } catch {
      // Container doesn't exist yet, proceed to create
    }

    const container = await this.client.createContainer({
      name: containerName,
      Image: config.imageName,
      HostConfig: {
        Binds: [`${volumePath}:/workspace`],
      },
      Env: [
        `PROJECT_ID=${projectId}`,
        `TEMPLATE_TYPE=${templateType}`,
      ],
    });

    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.client.getContainer(containerId);
    const info = await container.inspect();
    if (info.State.Status === 'running') return;
    await container.start();
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.client.getContainer(containerId);
    await container.stop({ t: 10 });
  }

  async removeContainer(containerId: string): Promise<void> {
    const container = this.client.getContainer(containerId);
    await container.remove({ force: true });
  }

  async getContainerStatus(containerId: string): Promise<string> {
    const container = this.client.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Status;
  }

  async getProjectContainerInfo(projectId: number): Promise<{ container: Docker.Container; id: string; status: string } | null> {
    const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

    try {
      const container = this.client.getContainer(containerName);
      const info = await container.inspect();
      return { container, id: info.Id, status: info.State.Status };
    } catch {
      return null;
    }
  }

  async getProjectContainer(projectId: number): Promise<Docker.Container | null> {
    const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

    try {
      const container = this.client.getContainer(containerName);
      await container.inspect();
      return container;
    } catch {
      return null;
    }
  }

  async execInContainer(
    containerId: string,
    command: string[]
  ): Promise<ExecResult> {
    const container = this.client.getContainer(containerId);

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      stream.on('data', (chunk: Buffer) => {
        // Docker stream 格式: 前8字节是header，之后是内容
        const type = chunk[0];
        const content = chunk.slice(8).toString();
        if (type === 1) stdout += content;
        else if (type === 2) stderr += content;
      });

      stream.on('error', reject);

      stream.on('end', async () => {
        const info = await exec.inspect();
        resolve({ stdout, stderr, exitCode: info.ExitCode ?? 0 });
      });
    });
  }

  async volumeExists(projectId: number): Promise<boolean> {
    const volumeName = `${VOLUME_NAME_PREFIX}${projectId}`;
    try {
      await this.client.getVolume(volumeName).inspect();
      return true;
    } catch {
      return false;
    }
  }

  async createProjectVolume(projectId: number): Promise<string> {
    const volumeName = `${VOLUME_NAME_PREFIX}${projectId}`;
    const volume = await this.client.createVolume({
      Name: volumeName,
    });
    return volume.Name;
  }

  async removeProjectVolume(projectId: number): Promise<void> {
    const volumeName = `${VOLUME_NAME_PREFIX}${projectId}`;
    try {
      await this.client.getVolume(volumeName).remove();
    } catch {
      // Volume may not exist
    }
  }

  getClient(): Docker {
    return this.client;
  }

  async cleanupTestContainers(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return;

    const containers = await this.client.listContainers({ all: true });
    for (const c of containers) {
      const isTest = c.Names.some((n) => n.startsWith('/test_'));
      if (isTest) {
        const container = this.client.getContainer(c.Id);
        if (c.State === 'running') {
          await container.stop({ t: 5 }).catch(() => {});
        }
        await container.remove({ force: true }).catch(() => {});
      }
    }

    const volumes = await this.client.listVolumes();
    for (const v of volumes.Volumes || []) {
      if (v.Name.startsWith('test_')) {
        await this.client.getVolume(v.Name).remove({ force: true }).catch(() => {});
      }
    }
  }
}
