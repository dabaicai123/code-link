import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createErrorHandler } from '../../src/core/errors/handler.js';
import { NotFoundError, ValidationError } from '../../src/core/errors/index.js';
import { LoggerService } from '../../src/core/logger/logger.js';

describe('createErrorHandler', () => {
  let handler: ReturnType<typeof createErrorHandler>;
  let mockLogger: LoggerService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    handler = createErrorHandler(mockLogger as LoggerService);

    mockReq = { requestId: 'test-request-id' };
    mockNext = vi.fn();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it('should handle AppError correctly', () => {
    const err = new NotFoundError('项目');
    handler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: '项目不存在' },
    });
  });

  it('should handle ValidationError with details', () => {
    const err = new ValidationError(['field is required', 'invalid format']);
    handler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: ['field is required', 'invalid format'],
      },
    });
  });

  it('should handle unknown errors as internal error', () => {
    const err = new Error('Unexpected error');
    handler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log AppError with warn level', () => {
    const err = new NotFoundError('项目');
    handler(err, mockReq as Request, mockRes as Response, mockNext);
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
