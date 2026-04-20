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

export const ErrorCode = {
  // 系统错误 10000-19999
  INTERNAL_ERROR: 10001,

  // 参数错误 20000-29999
  PARAM_MISSING: 20001,
  PARAM_INVALID: 20002,

  // 认证/授权错误 30000-39999
  UNAUTHORIZED: 30001,
  FORBIDDEN: 30002,

  // 业务错误 40000-49999
  NOT_FOUND: 40001,
  CLAUDE_CONFIG_MISSING: 40002,
  CONFLICT: 40003,
  ALREADY_EXISTS: 40004,
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export const Errors = {
  notFound: (resource: string): ErrorResponse =>
    errorResponse(ErrorCode.NOT_FOUND, `${resource}不存在`),

  forbidden: (message: string = '权限不足'): ErrorResponse =>
    errorResponse(ErrorCode.FORBIDDEN, message),

  unauthorized: (message: string = '请先登录'): ErrorResponse =>
    errorResponse(ErrorCode.UNAUTHORIZED, message),

  badRequest: (message: string, details?: string[]): ErrorResponse =>
    errorResponse(ErrorCode.PARAM_INVALID, message, details),

  paramMissing: (field: string): ErrorResponse =>
    errorResponse(ErrorCode.PARAM_MISSING, `缺少参数: ${field}`),

  paramInvalid: (field: string, reason?: string): ErrorResponse =>
    errorResponse(ErrorCode.PARAM_INVALID, reason || `参数格式错误: ${field}`),

  validationError: (details: string[]): ErrorResponse =>
    errorResponse(ErrorCode.PARAM_INVALID, '参数验证失败', details),

  conflict: (message: string): ErrorResponse =>
    errorResponse(ErrorCode.CONFLICT, message),

  internal: (message: string = '服务器内部错误'): ErrorResponse =>
    errorResponse(ErrorCode.INTERNAL_ERROR, message),
};
