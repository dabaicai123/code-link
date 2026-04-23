import { Request, Response, NextFunction } from 'express';
import { isAppError, ErrorCode } from './errors.js';
import { errorResponse } from './response.js';
import { LoggerService } from '../logger/logger.js';
import type { Logger } from '../logger/types.js';

export function createErrorHandler(logger: LoggerService | Logger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.requestId;
    const reqLog: Logger = req.log || logger;

    if (isAppError(err)) {
      reqLog.warn(`${err.code}: ${err.message}`, { requestId, code: err.code });
      res.status(err.httpStatus).json(
        errorResponse(err.code, err.message, err.details)
      );
      return;
    }

    reqLog.error('Unexpected error', err, { requestId });
    res.status(500).json(
      errorResponse(ErrorCode.INTERNAL, '服务器内部错误')
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