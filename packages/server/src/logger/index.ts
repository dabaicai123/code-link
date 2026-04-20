// packages/server/src/logger/index.ts

/**
 * @deprecated Use createLogger from '../core/logger/index.js' instead.
 * This console-based logger will be removed in future versions.
 * The new Pino-based logger provides better performance and structured logging.
 */

export { createLogger, setLogLevel, getLogLevel, Logger, type LogLevel } from './logger.js';
export { getLogContext, runWithLogContext, type LogContext } from './context.js';
export { generateShortId } from './id.js';
export { requestLoggingMiddleware } from './middleware.js';