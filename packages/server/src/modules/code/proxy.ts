import httpProxy from 'http-proxy';
import { CodeServerManager } from './lib/code-server-manager.js';
import { createLogger } from '../../core/logger/index.js';

const logger = createLogger('code-server-proxy');

const proxy = httpProxy.createProxyServer({
  ws: true,
});

proxy.on('error', (err, _req, _res) => {
  logger.error('Proxy error', err instanceof Error ? err : new Error(String(err)));
});

export function createCodeServerProxy(codeServerManager: CodeServerManager) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const projectId = Number(req.params.projectId);
    const info = codeServerManager.getCodeServerInfo(projectId);

    if (!info || !info.running) {
      res.status(503).json({ error: 'code-server is not running for this project' });
      return;
    }

    const target = `http://${info.containerIp}:8080`;
    const prefix = `/api/projects/${projectId}/code-server`;
    req.url = req.url.replace(prefix, '') || '/';

    proxy.web(req, res, { target }, next);
  };
}

export function handleCodeServerWebSocketUpgrade(
  codeServerManager: CodeServerManager,
  server: import('http').Server
) {
  server.on('upgrade', (req, socket, head) => {
    const match = req.url?.match(/^\/api\/projects\/(\d+)\/code-server/);
    if (!match) return;

    const projectId = Number(match[1]);
    const info = codeServerManager.getCodeServerInfo(projectId);

    if (!info || !info.running) {
      socket.destroy();
      return;
    }

    const target = `http://${info.containerIp}:8080`;
    const prefix = `/api/projects/${projectId}/code-server`;
    req.url = req.url!.replace(prefix, '') || '/';

    proxy.ws(req, socket, head, { target }, (err) => {
      logger.error('WS proxy error', err instanceof Error ? err : new Error(String(err)));
      socket.destroy();
    });
  });
}