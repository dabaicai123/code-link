import { Request, Response, NextFunction } from 'express';
import { isAppError } from './errors.js';
import { errorResponse } from './response.js';
import { LoggerService } from '../logger/logger.js';

const ErrorCodeMap: Record<string, number> = {
  'NOT_FOUND': 40001,
  'FORBIDDEN': 30002,
  'UNAUTHORIZED': 30001,
  'VALIDATION_ERROR': 20002,
  'BAD_REQUEST': 20002,
  'CONFLICT': 40003,
  'INTERNAL_ERROR': 10001,
};

export function createErrorHandler(logger: LoggerService) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as any).requestId || 'unknown';

    if (isAppError(err)) {
      logger.warn(`[${requestId}] ${err.code}: ${err.message}`);
      const code = ErrorCodeMap[err.code] || 10001;
      res.status(err.httpStatus).json(
        errorResponse(code, err.message, err.details)
      );
      return;
    }

    logger.error(`[${requestId}] Unexpected error:`, err);
    res.status(500).json(
      errorResponse(10001, '服务器内部错误')
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
