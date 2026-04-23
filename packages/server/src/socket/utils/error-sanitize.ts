// packages/server/src/socket/utils/error-sanitize.ts
import { getErrorMessage } from '../../core/errors/index.js';

const ALLOWED_ERROR_PATTERNS = [
  /^项目不存在/,
  /^容器未运行/,
  /^请先在/,
  /^未找到/,
  /^配置/,
  /^权限/,
  /^请/,
  /不存在或无权/,
  /未配置/,
];

const INTERNAL_ERROR_PATTERNS = [
  /docker/i,
  /daemon/i,
  /container.*not found/i,
  /socket/i,
  /database/i,
  /sqlite/i,
  /drizzle/i,
  /error response/i,
  /ENOENT/,
  /permission denied.*\/etc/i,
  /\/proc/i,
  /\/sys/i,
  /\.\.\//,
];

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return '操作失败';

  const message = getErrorMessage(error);

  for (const pattern of INTERNAL_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      if (/docker|container|daemon/i.test(message)) return '容器操作失败';
      if (/database|sqlite|drizzle/i.test(message)) return '数据操作失败';
      return '操作失败';
    }
  }

  for (const pattern of ALLOWED_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return message;
    }
  }

  return '操作失败';
}
