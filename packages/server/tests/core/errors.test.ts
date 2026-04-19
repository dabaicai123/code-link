import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  AuthError,
  ConflictError,
  isAppError,
  success,
  errorResponse,
} from '../../src/core/errors/index.js';

describe('Errors', () => {
  describe('AppError', () => {
    it('should create AppError with all properties', () => {
      const err = new AppError('Test error', 'TEST_ERROR', 400, ['detail1']);
      expect(err.message).toBe('Test error');
      expect(err.code).toBe('TEST_ERROR');
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual(['detail1']);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError', () => {
      const err = new ValidationError(['field is required', 'invalid format']);
      expect(err.message).toBe('参数验证失败');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual(['field is required', 'invalid format']);
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError', () => {
      const err = new NotFoundError('项目');
      expect(err.message).toBe('项目不存在');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.httpStatus).toBe(404);
    });
  });

  describe('PermissionError', () => {
    it('should create PermissionError with default message', () => {
      const err = new PermissionError();
      expect(err.message).toBe('权限不足');
      expect(err.code).toBe('FORBIDDEN');
      expect(err.httpStatus).toBe(403);
    });

    it('should create PermissionError with custom message', () => {
      const err = new PermissionError('只有管理员可以操作');
      expect(err.message).toBe('只有管理员可以操作');
    });
  });

  describe('AuthError', () => {
    it('should create AuthError', () => {
      const err = new AuthError();
      expect(err.message).toBe('请先登录');
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.httpStatus).toBe(401);
    });
  });

  describe('ConflictError', () => {
    it('should create ConflictError', () => {
      const err = new ConflictError('资源已存在');
      expect(err.message).toBe('资源已存在');
      expect(err.code).toBe('CONFLICT');
      expect(err.httpStatus).toBe(409);
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new NotFoundError('项目'))).toBe(true);
      expect(isAppError(new Error('test'))).toBe(false);
    });
  });

  describe('response helpers', () => {
    it('should create success response', () => {
      const res = success({ id: 1, name: 'test' });
      expect(res).toEqual({ success: true, data: { id: 1, name: 'test' } });
    });

    it('should create error response', () => {
      const res = errorResponse('NOT_FOUND', '资源不存在', 404);
      expect(res).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: '资源不存在' },
      });
    });

    it('should create error response with details', () => {
      const res = errorResponse('VALIDATION_ERROR', '验证失败', 400, ['field required']);
      expect(res).toEqual({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '验证失败', details: ['field required'] },
      });
    });
  });
});
