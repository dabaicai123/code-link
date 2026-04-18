// packages/server/tests/logger.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, LogLevel } from '../src/logger/logger.ts';
import { runWithLogContext } from '../src/logger/context.ts';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    };
    setLogLevel('DEBUG');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应正确格式化 DEBUG 级别日志', () => {
    const logger = createLogger('test');
    logger.debug('test message');

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0];
    expect(output).toContain('[DEBUG]');
    expect(output).toContain('[test]');
    expect(output).toContain('test message');
  });

  it('应正确格式化 INFO 级别日志', () => {
    const logger = createLogger('server');
    logger.info('server started');

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0];
    expect(output).toContain('[INFO]');
    expect(output).toContain('[server]');
    expect(output).toContain('server started');
  });

  it('应正确格式化 WARN 级别日志', () => {
    const logger = createLogger('auth');
    logger.warn('token expired');

    expect(consoleSpy.warn).toHaveBeenCalled();
    const output = consoleSpy.warn.mock.calls[0][0];
    expect(output).toContain('[WARN]');
    expect(output).toContain('[auth]');
    expect(output).toContain('token expired');
  });

  it('应正确格式化 ERROR 级别日志', () => {
    const logger = createLogger('docker');
    const error = new Error('container not found');
    logger.error('failed to start', error);

    expect(consoleSpy.error).toHaveBeenCalled();
    const output = consoleSpy.error.mock.calls[0][0];
    expect(output).toContain('[ERROR]');
    expect(output).toContain('[docker]');
    expect(output).toContain('failed to start');
    expect(output).toContain('container not found');
  });

  it('应在上下文中自动获取 reqId', () => {
    const logger = createLogger('routes');
    runWithLogContext('abc123', () => {
      logger.info('processing request');
    });

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0];
    expect(output).toContain('[req:abc123]');
  });

  it('无上下文时应不显示 reqId', () => {
    const logger = createLogger('server');
    logger.info('server started');

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0];
    expect(output).not.toContain('[req:');
  });

  it('应根据日志级别过滤输出', () => {
    setLogLevel('INFO');
    const logger = createLogger('test');

    logger.debug('debug message');
    logger.info('info message');

    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    expect(consoleSpy.log.mock.calls[0][0]).toContain('info message');
  });

  it('ERROR 级别应始终输出', () => {
    setLogLevel('ERROR');
    const logger = createLogger('test');

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error.mock.calls[0][0]).toContain('error');
  });
});