export const ErrorCode = {
  INTERNAL: 10001,
  VALIDATION: 20002,
  AUTH: 30001,
  PERMISSION: 30002,
  NOT_FOUND: 40001,
  CONFLICT: 40003,
} as const;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly httpStatus: number,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(details: string[]) {
    super('参数验证失败', ErrorCode.VALIDATION, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}不存在`, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, ErrorCode.PERMISSION, 403);
    this.name = 'PermissionError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = '请先登录') {
    super(message, ErrorCode.AUTH, 401);
    this.name = 'AuthError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT, 409);
    this.name = 'ConflictError';
  }
}

export class ParamError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.VALIDATION, 400);
    this.name = 'ParamError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export function normalizeError(error: unknown): Error {
  if (isError(error)) return error;
  return new Error(String(error));
}