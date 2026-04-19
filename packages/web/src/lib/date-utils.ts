// packages/web/src/lib/date-utils.ts

/**
 * 格式化日期为本地化字符串
 * @param date 日期字符串或 Date 对象
 * @param locale 语言环境，默认中文
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: string | Date, locale: string = 'zh-CN'): string {
  return new Date(date).toLocaleDateString(locale);
}

/**
 * 格式化日期时间
 * @param date 日期字符串或 Date 对象
 * @param locale 语言环境，默认中文
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(date: string | Date, locale: string = 'zh-CN'): string {
  return new Date(date).toLocaleString(locale);
}

/**
 * 相对时间格式化（如"3 天前"）
 * @param date 日期字符串或 Date 对象
 * @returns 相对时间字符串
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatDate(date);
}
