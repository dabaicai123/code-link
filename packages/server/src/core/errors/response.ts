export interface SuccessResponse<T> {
  code: 0;
  data: T;
}

export interface ErrorResponse {
  code: number;
  error: string;
  details?: string[];
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T): SuccessResponse<T> {
  return { code: 0, data };
}

export function errorResponse(
  code: number,
  message: string,
  details?: string[]
): ErrorResponse {
  return { code, error: message, details };
}

export const Errors = {
  notFound: (resource: string): ErrorResponse =>
    errorResponse(40001, `${resource}不存在`),

  forbidden: (message: string = '权限不足'): ErrorResponse =>
    errorResponse(30002, message),

  unauthorized: (message: string = '请先登录'): ErrorResponse =>
    errorResponse(30001, message),

  badRequest: (message: string, details?: string[]): ErrorResponse =>
    errorResponse(20002, message, details),

  validationError: (details: string[]): ErrorResponse =>
    errorResponse(20002, '参数验证失败', details),

  conflict: (message: string): ErrorResponse =>
    errorResponse(40003, message),

  internal: (message: string = '服务器内部错误'): ErrorResponse =>
    errorResponse(10001, message),
};
