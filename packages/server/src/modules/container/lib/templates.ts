import path from 'path';
import Docker from 'dockerode';

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

export async function ensureTemplateImage(docker: Docker, type: TemplateType): Promise<void> {
  const config = getTemplateConfig(type);

  // 检查镜像是否已存在
  const images = await docker.listImages({ filters: `{"dangling":["false"],"reference":["${config.imageName}"]}` });
  if (images.length > 0) return;

  // 构建上下文使用 templates 父目录
  const templatesDir = path.dirname(config.dockerfileDir);

  // 构建镜像
  const stream = await docker.buildImage(
    {
      context: templatesDir,
      src: [
        'claude.json',
        'claude-settings.json',
        `${type}/Dockerfile`,
        `${type}/entrypoint.sh`
      ]
    },
    { t: config.imageName, dockerfile: `${type}/Dockerfile` }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
}