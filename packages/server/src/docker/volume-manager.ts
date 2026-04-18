// src/docker/volume-manager.ts
import fs from 'fs/promises';
import path from 'path';

const VOLUMES_BASE_DIR = process.env.VOLUMES_DIR || path.join(process.cwd(), 'volumes');

export function getVolumePath(projectId: number): string {
  return path.join(VOLUMES_BASE_DIR, `project-${projectId}`);
}

export async function createProjectVolume(projectId: number): Promise<string> {
  const volumePath = getVolumePath(projectId);

  await fs.mkdir(volumePath, { recursive: true });

  // 创建基础目录结构
  await fs.mkdir(path.join(volumePath, 'src'), { recursive: true });

  // 创建默认 Dockerfile
  const dockerfileContent = `FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
`;
  await fs.writeFile(path.join(volumePath, 'Dockerfile'), dockerfileContent);

  return volumePath;
}

export async function removeProjectVolume(projectId: number): Promise<void> {
  const volumePath = getVolumePath(projectId);
  await fs.rm(volumePath, { recursive: true, force: true });
}

export async function volumeExists(projectId: number): Promise<boolean> {
  const volumePath = getVolumePath(projectId);
  try {
    await fs.stat(volumePath);
    return true;
  } catch {
    return false;
  }
}