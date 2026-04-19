// packages/web/tests/lib/date-utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime, formatShortDate, formatISODate } from '@/lib/date-utils';

describe('date-utils', () => {
  const testDate = new Date('2026-04-19T10:30:00Z');

  it('formatDate returns locale date string', () => {
    const result = formatDate(testDate);
    expect(result).toContain('2026');
  });

  it('formatDateTime returns locale datetime string', () => {
    const result = formatDateTime(testDate);
    expect(result).toContain('2026');
    expect(result.length).toBeGreaterThan(formatDate(testDate).length);
  });

  it('formatRelativeTime returns "刚刚" for recent dates', () => {
    const now = new Date();
    const result = formatRelativeTime(now);
    expect(result).toBe('刚刚');
  });

  it('formatRelativeTime returns minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinutesAgo);
    expect(result).toBe('5 分钟前');
  });

  it('formatRelativeTime returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toBe('2 小时前');
  });

  it('formatRelativeTime returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toBe('3 天前');
  });

  it('formatShortDate returns time for today', () => {
    const today = new Date();
    const result = formatShortDate(today);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('formatShortDate returns "昨天" for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatShortDate(yesterday);
    expect(result).toBe('昨天');
  });

  it('formatShortDate returns days ago for less than 7 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatShortDate(threeDaysAgo);
    expect(result).toBe('3天前');
  });

  it('formatShortDate returns date format for more than 7 days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const result = formatShortDate(tenDaysAgo);
    expect(result).toMatch(/^\d+月\d+日$/);
  });

  it('formatISODate returns ISO format', () => {
    const result = formatISODate(testDate);
    expect(result).toBe('2026-04-19');
  });
});
