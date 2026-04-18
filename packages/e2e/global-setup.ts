// packages/e2e/global-setup.ts
import { spawn, ChildProcess } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let webProcess: ChildProcess | null = null;

async function waitForServer(url: string, timeout = 60000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 服务器还没启动，继续等待
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`服务器启动超时: ${url}`);
}

export default async function globalSetup() {
  // 如果环境变量已指定外部前端服务，跳过启动
  if (process.env.WEB_BASE_URL) {
    console.log('使用外部前端服务:', process.env.WEB_BASE_URL);
    return;
  }

  const webBaseUrl = 'http://localhost:3000';

  // 检查前端服务是否已经运行
  try {
    const response = await fetch(webBaseUrl);
    if (response.ok) {
      console.log('前端服务已在运行:', webBaseUrl);
      return;
    }
  } catch {
    // 服务未运行，需要启动
  }

  // 启动前端开发服务器
  const rootDir = resolve(__dirname, '..', '..');
  console.log('启动前端开发服务器...');

  webProcess = spawn('pnpm', ['--filter', '@code-link/web', 'dev'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  webProcess.stdout?.on('data', (data) => {
    console.log(`[web] ${data.toString().trim()}`);
  });

  webProcess.stderr?.on('data', (data) => {
    console.error(`[web] ${data.toString().trim()}`);
  });

  // 等待服务启动
  await waitForServer(webBaseUrl);
  console.log('前端服务已启动:', webBaseUrl);

  // 保存 PID 以便 teardown 清理
  process.env.E2E_WEB_PROCESS_PID = webProcess.pid?.toString() || '';
}

// 导出 teardown 函数
export { webProcess };
