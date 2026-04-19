import { Request, Response, NextFunction } from 'express';
import { isAppError } from './errors.js';
import { errorResponse } from './response.js';
import { LoggerService } from '../logger/logger.js';

export function createErrorHandler(logger: LoggerService) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as any).requestId || 'unknown';

    if (isAppError(err)) {
      logger.warn(`[${requestId}] ${err.code}: ${err.message}`);
      res.status(err.httpStatus).json(
        errorResponse(err.code, err.message, err.httpStatus, err.details)
      );
      return;
    }

    logger.error(`[${requestId}] Unexpected error:`, err);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', '服务器内部错误', 500)
    );
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
