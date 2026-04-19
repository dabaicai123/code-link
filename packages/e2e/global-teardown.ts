// packages/e2e/global-teardown.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalTeardown() {
  // 清理前端服务进程（使用 pkill 杀死进程树）
  const pid = process.env.E2E_WEB_PROCESS_PID;
  if (pid) {
    try {
      // 使用 pkill 杀死整个进程组
      await execAsync(`pkill -P ${pid} 2>/dev/null || true`);
      process.kill(Number(pid), 'SIGTERM');
      console.log('已停止前端服务进程:', pid);
    } catch (err) {
      // 进程可能已经退出
    }
  }

  // 额外清理：确保没有残留的 next 进程
  try {
    await execAsync('pkill -f "next dev" 2>/dev/null || true');
  } catch {
    // 忽略错误
  }

  console.log('E2E 测试清理完成');
}