// packages/e2e/global-teardown.ts
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalTeardown() {
  // 清理前端服务进程
  const pid = process.env.E2E_WEB_PROCESS_PID;
  if (pid) {
    try {
      // 杀死进程树
      process.kill(Number(pid), 'SIGTERM');
      console.log('已停止前端服务进程:', pid);
    } catch (err) {
      // 进程可能已经退出
    }
  }

  console.log('E2E 测试清理完成');
}
