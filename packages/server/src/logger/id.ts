// packages/server/src/logger/id.ts

/**
 * 生成短格式 UUID (8字符)
 * 用于请求追踪标识
 */
export function generateShortId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}