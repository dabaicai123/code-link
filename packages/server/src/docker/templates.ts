import path from 'path';
import { getDockerClient } from './client.js';

export const TEMPLATE_TYPES = ['node', 'node+java', 'node+python'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

interface TemplateConfig {
  imageName: string;
  dockerfileDir: string;
  baseImage: string;
}

const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  node: {
    imageName: 'code-link-node:latest',
    dockerfileDir: path.join(process.cwd(), 'docker/templates/node'),
    baseImage: 'node:22-slim',
  },
  'node+java': {
    imageName: 'code-link-node-java:latest',
    dockerfileDir: path.join(process.cwd(), 'docker/templates/node+java'),
    baseImage: 'node:22-slim',
  },
  'node+python': {
    imageName: 'code-link-node-python:latest',
    dockerfileDir: path.join(process.cwd(), 'docker/templates/node+python'),
    baseImage: 'node:22-slim',
  },
};

export function getTemplateConfig(type: TemplateType): TemplateConfig {
  return TEMPLATE_CONFIGS[type];
}

export function isValidTemplate(type: string): type is TemplateType {
  return TEMPLATE_TYPES.includes(type as TemplateType);
}

export async function ensureTemplateImage(type: TemplateType): Promise<void> {
  const docker = getDockerClient();
  const config = getTemplateConfig(type);

  // 检查镜像是否已存在
  const images = await docker.listImages({ filters: `{"dangling":["false"],"reference":["${config.imageName}"]}` });
  if (images.length > 0) return;

  // 构建镜像
  const stream = await docker.buildImage(
    { context: config.dockerfileDir, src: ['Dockerfile', 'entrypoint.sh'] },
    { t: config.imageName }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
}