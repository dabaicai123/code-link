// packages/server/src/logger/context.ts

import { AsyncLocalStorage } from 'async_hooks';

export interface LogContext {
  reqId: string;
}

const logContextStorage = new AsyncLocalStorage<LogContext>();

/**
 * 获取当前请求上下文
 */
export function getLogContext(): LogContext | undefined {
  return logContextStorage.getStore();
}

/**
 * 在指定上下文中运行函数
 * 所有在该函数内调用的 logger 方法都会自动获取 reqId
 */
export function runWithLogContext<T>(reqId: string, fn: () => T): T {
  return logContextStorage.run({ reqId }, fn);
}