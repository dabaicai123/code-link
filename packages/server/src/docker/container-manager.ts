import Docker from 'dockerode';
import { getDockerClient } from './client.ts';
import { ensureTemplateImage, getTemplateConfig, TemplateType } from './templates.ts';

const CONTAINER_NAME_PREFIX = 'code-link-project-';

export async function createProjectContainer(
  projectId: number,
  templateType: TemplateType,
  volumePath: string
): Promise<string> {
  const docker = getDockerClient();
  const config = getTemplateConfig(templateType);

  await ensureTemplateImage(templateType);

  const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

  // 检查是否已存在同名容器
  try {
    const existing = await docker.getContainer(containerName).inspect();
    return existing.Id;
  } catch {
    // 不存在，继续创建
  }

  const container = await docker.createContainer({
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

export async function startContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.start();
}

export async function stopContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.stop({ t: 10 });
}

export async function removeContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.remove({ force: true });
}

export async function getContainerStatus(containerId: string): Promise<string> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  return info.State.Status;
}

export async function getProjectContainer(projectId: number): Promise<Docker.Container | null> {
  const docker = getDockerClient();
  const containerName = `${CONTAINER_NAME_PREFIX}${projectId}`;

  try {
    await docker.getContainer(containerName).inspect();
    return docker.getContainer(containerName);
  } catch {
    return null;
  }
}

export async function execInContainer(
  containerId: string,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

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
      resolve({ stdout, stderr, exitCode: info.ExitCode });
    });
  });
}
