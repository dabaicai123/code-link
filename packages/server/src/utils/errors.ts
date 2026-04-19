// packages/server/src/utils/errors.ts

/**
 * 业务错误基类
 */
export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 500
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

/**
 * 权限错误
 */
export class PermissionError extends BusinessError {
  constructor(message: string = '权限不足') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'PermissionError';
  }
}

/**
 * 资源不存在错误
 */
export class NotFoundError extends BusinessError {
  constructor(resource: string) {
    super(`${resource}不存在`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 参数错误
 */
export class ParamError extends BusinessError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST', 400);
    this.name = 'ParamError';
  }
}

/**
 * 冲突错误（如名称重复、状态冲突）
 */
export class ConflictError extends BusinessError {
  constructor(message: string) {
    super(message, 'CONFLICT', 400);
    this.name = 'ConflictError';
  }
}

/**
 * 认证错误
 */
export class AuthError extends BusinessError {
  constructor(message: string = '请先登录') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'AuthError';
  }
}

/**
 * 类型守卫函数
 */
export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError;
}

export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError;
}
