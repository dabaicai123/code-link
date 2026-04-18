// packages/server/src/utils/response.ts

/**
 * API 统一响应格式
 */

export interface ApiResponse<T> {
  code: 0;
  data: T;
}

export interface ApiErrorResponse {
  code: number;
  error: string;
}

/**
 * 成功响应
 */
export function success<T>(data: T): ApiResponse<T> {
  return { code: 0, data };
}

/**
 * 失败响应
 */
export function fail(code: number, error: string): ApiErrorResponse {
  return { code, error };
}

/**
 * 错误码常量
 */
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

/**
 * 预定义错误工厂函数
 */
export const Errors = {
  // 系统错误
  internal: (msg?: string) => fail(ErrorCode.INTERNAL_ERROR, msg || '服务器内部错误'),

  // 参数错误
  paramMissing: (field: string) => fail(ErrorCode.PARAM_MISSING, `缺少参数: ${field}`),
  paramInvalid: (field: string, reason?: string) => fail(ErrorCode.PARAM_INVALID, reason || `参数格式错误: ${field}`),

  // 认证/授权错误
  unauthorized: () => fail(ErrorCode.UNAUTHORIZED, '请先登录'),
  forbidden: () => fail(ErrorCode.FORBIDDEN, '权限不足'),

  // 业务错误
  notFound: (resource: string) => fail(ErrorCode.NOT_FOUND, `${resource}不存在`),
  claudeConfigMissing: () => fail(ErrorCode.CLAUDE_CONFIG_MISSING, '请先在「设置 → Claude Code 配置」中完成配置'),
  conflict: (msg: string) => fail(ErrorCode.CONFLICT, msg),
  alreadyExists: (resource: string) => fail(ErrorCode.ALREADY_EXISTS, `${resource}已存在`),
};
