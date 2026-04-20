const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';

async function checkFrontendRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const isRunning = await checkFrontendRunning(WEB_BASE_URL);
  if (!isRunning) {
    throw new Error(
      `前端服务未运行: ${WEB_BASE_URL}\n` +
      `请先启动前端: pnpm --filter @code-link/web dev\n` +
      `或构建后启动: pnpm --filter @code-link/web build && pnpm --filter @code-link/web start`
    );
  }
  console.log('前端服务已就绪:', WEB_BASE_URL);
}
