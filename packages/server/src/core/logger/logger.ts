import { singleton } from 'tsyringe';
import pino, { Logger as PinoLogger } from 'pino';
import type { Logger, LogContext } from './types.js';

@singleton()
export class LoggerService implements Logger {
  private logger: PinoLogger;
  private moduleName?: string;

  constructor(levelOrParent?: string | PinoLogger) {
    if (typeof levelOrParent === 'object') {
      // 子 logger，使用父 logger
      this.logger = levelOrParent;
    } else {
      // 主 logger
      this.logger = pino({
        level: levelOrParent || 'info',
        transport: process.env.NODE_ENV !== 'test'
          ? {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' },
            }
          : undefined,
      });
    }
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(context || {}, this.formatMessage(message));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(context || {}, this.formatMessage(message));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? { ...context, error: error.message, stack: error.stack }
      : context;
    this.logger.error(errorContext || {}, this.formatMessage(message));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(context || {}, this.formatMessage(message));
  }

  child(module: string): Logger {
    const childLogger = new LoggerService(this.logger.child({ module }));
    childLogger.moduleName = module;
    return childLogger;
  }

  withContext(context: Record<string, unknown>): Logger {
    const childPino = this.logger.child(context);
    return new LoggerService(childPino);
  }

  private formatMessage(message: string): string {
    return this.moduleName ? `[${this.moduleName}] ${message}` : message;
  }
}

export function createLogger(module: string): Logger {
  const service = new LoggerService(process.env.LOG_LEVEL || 'info');
  return service.child(module);
}
