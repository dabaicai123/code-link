import { singleton, inject } from 'tsyringe';
import { DockerService } from '../../container/lib/docker.service.js';
import { getPortManager } from '../../build/lib/port-manager.js';
import { createLogger } from '../../../core/logger/index.js';

const logger = createLogger('code-server-manager');

interface CodeServerInfo {
  port: number;
  running: boolean;
}

@singleton()
export class CodeServerManager {
  private codeServerInfo: Map<number, CodeServerInfo> = new Map();

  constructor(@inject(DockerService) private readonly docker: DockerService) {}

  async startCodeServer(projectId: number, containerId: string): Promise<number> {
    const portManager = getPortManager();

    // If already tracked, return existing port
    const existing = this.codeServerInfo.get(projectId);
    if (existing && existing.running) {
      return existing.port;
    }

    // Allocate port (or recover from existing info)
    const port = existing?.port ?? portManager.allocatePort();

    try {
      // Start code-server inside the container via docker exec
      // Uses nohup so the process survives after exec exits
      // Runs as codelink user (container default), --auth none for internal network
      const result = await this.docker.execInContainer(containerId, [
        'sh', '-c',
        'nohup code-server --auth none --bind-addr 0.0.0.0:8080 --disable-telemetry --disable-update-check /workspace > /home/codelink/code-server.log 2>&1 & echo "code-server started"',
      ]);

      if (result.exitCode !== 0 && result.stderr) {
        logger.warn('code-server start may have issues', { stderr: result.stderr });
      }

      // Wait for code-server to become ready (poll up to 15 seconds)
      await this.waitForReady(containerId);

      this.codeServerInfo.set(projectId, { port, running: true });
      logger.info('code-server started', { projectId, port });
      return port;
    } catch (error) {
      // If startup fails, release the port
      if (!existing) {
        portManager.releasePort(port);
      }
      logger.error('Failed to start code-server', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async stopCodeServer(projectId: number, containerId: string): Promise<void> {
    const info = this.codeServerInfo.get(projectId);
    if (!info) return;

    try {
      await this.docker.execInContainer(containerId, ['pkill', '-f', 'code-server']);
    } catch {
      // Process might not exist, that's fine
    }

    const portManager = getPortManager();
    portManager.releasePort(info.port);
    this.codeServerInfo.delete(projectId);
    logger.info('code-server stopped', { projectId });
  }

  getCodeServerUrl(projectId: number): string | null {
    const info = this.codeServerInfo.get(projectId);
    if (!info) return null;
    const host = process.env.CODE_SERVER_HOST || process.env.PREVIEW_HOST || 'localhost';
    return `http://${host}:${info.port}`;
  }

  getAllocatedPort(projectId: number): number | null {
    const info = this.codeServerInfo.get(projectId);
    return info?.port ?? null;
  }

  isRunning(projectId: number): boolean {
    return this.codeServerInfo.get(projectId)?.running ?? false;
  }

  private async waitForReady(containerId: string): Promise<void> {
    const maxRetries = 15;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.docker.execInContainer(containerId, [
          'sh', '-c', 'curl -s -o /dev/null -w "%{http_code}" http://localhost:8080',
        ]);
        if (result.stdout.trim() === '200' || result.stdout.trim() === '302') {
          logger.info('code-server is ready');
          return;
        }
      } catch {
        // curl might not be available, try wget or just wait
      }
      // Wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    // Even if we can't confirm readiness, code-server might still be starting
    logger.warn('code-server readiness check timed out, assuming it will become available');
  }
}