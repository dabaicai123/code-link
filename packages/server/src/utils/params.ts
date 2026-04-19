// packages/server/src/utils/params.ts

/**
 * 解析路由参数中的 ID
 * @param value 路由参数值（可能是 string 或 string[]）
 * @returns 解析后的数字 ID，无效时返回 null
 */
export function parseIdParam(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const id = parseInt(Array.isArray(value) ? value[0] : value, 10);
  return isNaN(id) ? null : id;
}

/**
 * 解析路由参数中的 ID（抛出错误版本）
 * @param value 路由参数值
 * @param paramName 参数名称（用于错误信息）
 * @throws Error 如果 ID 无效
 */
export function requireIdParam(value: string | string[] | undefined, paramName: string = 'ID'): number {
  const id = parseIdParam(value);
  if (id === null) {
    throw new Error(`无效的${paramName}`);
  }
  return id;
}
