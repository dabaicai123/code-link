export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(details: string[]) {
    super('参数验证失败', 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}不存在`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'PermissionError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = '请先登录') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'AuthError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class ParamError extends AppError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST', 400);
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

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Safely extract error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) return error.stack;
  return undefined;
}
