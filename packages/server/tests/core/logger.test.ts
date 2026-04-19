import "reflect-metadata";
import { describe, it, expect, beforeEach } from 'vitest';
import { LoggerService } from '../../src/core/logger/logger.js';

describe('LoggerService', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService('debug');
  });

  it('should create logger instance', () => {
    expect(logger).toBeDefined();
  });

  it('should have info, warn, error, debug methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log messages without throwing', () => {
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.warn('warn message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
    expect(() => logger.debug('debug message')).not.toThrow();
  });

  it('should log with context object', () => {
    expect(() => logger.info('test', { userId: 1, action: 'test' })).not.toThrow();
  });

  it('should create child logger with module name', () => {
    const childLogger = logger.child('auth');
    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
  });
});
