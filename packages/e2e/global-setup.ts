const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function checkServiceRunning(url: string, name: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const frontendRunning = await checkServiceRunning(WEB_BASE_URL, '前端');
  if (!frontendRunning) {
    throw new Error(
      `前端服务未运行: ${WEB_BASE_URL}\n` +
      `请先运行: ./scripts/start-e2e.sh\n` +
      `或手动启动: pnpm --filter @code-link/web dev`
    );
  }
  console.log('前端服务已就绪:', WEB_BASE_URL);

  const apiRunning = await checkServiceRunning(`${API_BASE_URL}/api/health`, '后端');
  if (!apiRunning) {
    throw new Error(
      `后端服务未运行: ${API_BASE_URL}\n` +
      `请先运行: ./scripts/start-e2e.sh\n` +
      `或手动启动: pnpm --filter @code-link/server start`
    );
  }
  console.log('后端服务已就绪:', API_BASE_URL);
}
