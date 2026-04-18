// packages/server/src/logger/logger.ts

import { getLogContext } from './context.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('DEBUG', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, args);
  }

  error(message: string, error?: Error | unknown): void {
    const errorStr = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : error !== undefined
        ? String(error)
        : '';
    this.log('ERROR', `${message}${errorStr ? ': ' + errorStr : ''}`);
  }

  private log(level: LogLevel, message: string, args: unknown[] = []): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) {
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 23);
    const context = getLogContext();
    const reqIdPart = context ? `[req:${context.reqId}] ` : '';
    const formatted = `[${timestamp}] [${level}] ${reqIdPart}[${this.module}] ${message}`;

    const outputArgs = args.length > 0 ? [formatted, ...args] : [formatted];

    switch (level) {
      case 'ERROR':
        console.error(...outputArgs);
        break;
      case 'WARN':
        console.warn(...outputArgs);
        break;
      default:
        console.log(...outputArgs);
    }
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}