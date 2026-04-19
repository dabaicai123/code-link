export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function errorResponse(
  code: string,
  message: string,
  httpStatus: number,
  details?: string[]
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
  };
}

export const Errors = {
  notFound: (resource: string): ErrorResponse =>
    errorResponse('NOT_FOUND', `${resource}不存在`, 404),

  forbidden: (message: string = '权限不足'): ErrorResponse =>
    errorResponse('FORBIDDEN', message, 403),

  unauthorized: (message: string = '请先登录'): ErrorResponse =>
    errorResponse('UNAUTHORIZED', message, 401),

  badRequest: (message: string, details?: string[]): ErrorResponse =>
    errorResponse('BAD_REQUEST', message, 400, details),

  validationError: (details: string[]): ErrorResponse =>
    errorResponse('VALIDATION_ERROR', '参数验证失败', 400, details),

  conflict: (message: string): ErrorResponse =>
    errorResponse('CONFLICT', message, 409),

  internal: (message: string = '服务器内部错误'): ErrorResponse =>
    errorResponse('INTERNAL_ERROR', message, 500),
};
