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
    super('参数验证失败', 20002, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}不存在`, 40001, 404);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, 30002, 403);
    this.name = 'PermissionError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = '请先登录') {
    super(message, 30001, 401);
    this.name = 'AuthError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 40003, 409);
    this.name = 'ConflictError';
  }
}

export class ParamError extends AppError {
  constructor(message: string) {
    super(message, 20002, 400);
    this.name = 'ParamError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
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

export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) return error.stack;
  return undefined;
}