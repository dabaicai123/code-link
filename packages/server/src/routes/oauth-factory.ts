// packages/server/src/routes/oauth-factory.ts
import { Router } from 'express';
import { TokenManager } from '../git/token-manager.js';
import { success, Errors, handleRouteError } from '../utils/response.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('oauth');

export type GitProviderName = 'github' | 'gitlab';

export interface OAuthProvider {
  name: GitProviderName;
  getOAuthUrl: (config: any) => string;
  exchangeCode: (config: any, code: string) => Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

export interface OAuthRouterOptions {
  provider: OAuthProvider;
  getConfig: () => any;
}

/**
 * 创建 OAuth 路由的基础工厂函数
 */
export function createOAuthRouterBase(options: OAuthRouterOptions): Router {
  const router = Router();
  const tokenManager = new TokenManager();
  const { provider, getConfig } = options;

  // GET /oauth - 获取 OAuth URL
  router.get('/oauth', (_req, res) => {
    const config = getConfig();
    const url = provider.getOAuthUrl(config);
    res.json(success({ url }));
  });

  // POST /oauth/callback - 处理 OAuth 回调
  router.post('/oauth/callback', async (req, res) => {
    const { code, userId } = req.body;

    if (!code || !userId) {
      res.status(400).json(Errors.paramMissing('code 或 userId'));
      return;
    }

    try {
      const config = getConfig();
      const tokenResponse = await provider.exchangeCode(config, code);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      await tokenManager.saveToken(
        userId,
        provider.name,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt
      );

      res.json(success({ success: true }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, 'OAuth 回调处理失败');
    }
  });

  // DELETE /token - 删除 Token
  router.delete('/token', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    await tokenManager.deleteToken(Number(userId), provider.name);
    res.status(204).send();
  });

  // GET /status - 检查授权状态
  router.get('/status', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    const hasToken = await tokenManager.hasToken(Number(userId), provider.name);
    res.json(success({ authorized: hasToken }));
  });

  return router;
}

/**
 * 创建需要 token 验证的路由处理器
 */
export function createTokenRequiredHandler(
  tokenManager: TokenManager,
  providerName: GitProviderName,
  handler: (token: string, req: any, res: any) => Promise<void>
) {
  return async (req: any, res: any) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json(Errors.paramMissing('userId'));
      return;
    }

    const token = await tokenManager.getToken(Number(userId), providerName);
    if (!token) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    try {
      await handler(token.accessToken, req, res);
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '请求处理失败');
    }
  };
}
