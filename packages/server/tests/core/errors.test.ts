import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  AuthError,
  ConflictError,
  ParamError,
  isAppError,
  success,
  errorResponse,
} from '../../src/core/errors/index.js';

describe('Errors', () => {
  describe('AppError', () => {
    it('should create AppError with all properties', () => {
      const err = new AppError('Test error', 99999, 400, ['detail1']);
      expect(err.message).toBe('Test error');
      expect(err.code).toBe(99999);
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual(['detail1']);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError', () => {
      const err = new ValidationError(['field is required', 'invalid format']);
      expect(err.message).toBe('参数验证失败');
      expect(err.code).toBe(20002);
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual(['field is required', 'invalid format']);
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError', () => {
      const err = new NotFoundError('项目');
      expect(err.message).toBe('项目不存在');
      expect(err.code).toBe(40001);
      expect(err.httpStatus).toBe(404);
    });
  });

  describe('PermissionError', () => {
    it('should create PermissionError with default message', () => {
      const err = new PermissionError();
      expect(err.message).toBe('权限不足');
      expect(err.code).toBe(30002);
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
      expect(err.code).toBe(30001);
      expect(err.httpStatus).toBe(401);
    });
  });

  describe('ConflictError', () => {
    it('should create ConflictError', () => {
      const err = new ConflictError('资源已存在');
      expect(err.message).toBe('资源已存在');
      expect(err.code).toBe(40003);
      expect(err.httpStatus).toBe(409);
    });
  });

  describe('ParamError', () => {
    it('should create ParamError', () => {
      const err = new ParamError('参数格式错误');
      expect(err.message).toBe('参数格式错误');
      expect(err.code).toBe(20002);
      expect(err.httpStatus).toBe(400);
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
      expect(res).toEqual({ code: 0, data: { id: 1, name: 'test' } });
    });

    it('should create error response', () => {
      const res = errorResponse(40001, '资源不存在');
      expect(res).toEqual({
        code: 40001,
        error: '资源不存在',
      });
    });

    it('should create error response with details', () => {
      const res = errorResponse(20002, '验证失败', ['field required']);
      expect(res).toEqual({
        code: 20002,
        error: '验证失败',
        details: ['field required'],
      });
    });
  });
});