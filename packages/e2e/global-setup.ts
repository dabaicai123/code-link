// packages/e2e/global-setup.ts

export default async function globalSetup() {
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

  console.log('检查前端服务可用性:', webBaseUrl);

  // 检查前端服务是否运行
  try {
    const response = await fetch(webBaseUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`前端服务返回错误状态: ${response.status}`);
    }
    console.log('前端服务已就绪:', webBaseUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`
前端服务未运行: ${errorMessage}

请先构建并启动前端服务器:
  pnpm --filter @code-link/web build
  pnpm --filter @code-link/web start

或者设置 WEB_BASE_URL 环境变量指向已运行的服务:
  WEB_BASE_URL=http://your-server:port pnpm --filter @code-link/e2e test
    `.trim());
  }
}
