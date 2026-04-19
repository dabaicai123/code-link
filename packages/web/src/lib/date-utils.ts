// packages/web/src/lib/date-utils.ts
import {
  format,
  formatDistanceToNow,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 格式化日期为本地化字符串
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy年M月d日', { locale: zhCN });
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy年M月d日 HH:mm', { locale: zhCN });
}

/**
 * 相对时间格式化（如"3 天前"）
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
}

/**
 * 格式化短日期（用于列表显示）
 */
export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return format(d, 'HH:mm', { locale: zhCN });
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return format(d, 'M月d日', { locale: zhCN });
  }
}

/**
 * 格式化 ISO 日期
 */
export function formatISODate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}
