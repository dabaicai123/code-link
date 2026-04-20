import { describe, it, expect } from 'vitest';
import { NotFoundError, PermissionError, ParamError, ConflictError, AuthError } from '../src/core/errors/index.js';

describe('BusinessError', () => {
  it('should have correct code and httpStatus', () => {
    const error = new PermissionError();
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
  });

  it('NotFoundError should include resource name', () => {
    const error = new NotFoundError('项目');
    expect(error.message).toBe('项目不存在');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.httpStatus).toBe(404);
  });

  it('ParamError should have custom message', () => {
    const error = new ParamError('名称不能为空');
    expect(error.message).toBe('名称不能为空');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.httpStatus).toBe(400);
  });

  it('ConflictError should have custom message', () => {
    const error = new ConflictError('名称已被使用');
    expect(error.message).toBe('名称已被使用');
    expect(error.code).toBe('CONFLICT');
    expect(error.httpStatus).toBe(409);
  });

  it('AuthError should have default message', () => {
    const error = new AuthError();
    expect(error.message).toBe('请先登录');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.httpStatus).toBe(401);
  });

  it('AuthError can have custom message', () => {
    const error = new AuthError('邮箱或密码错误');
    expect(error.message).toBe('邮箱或密码错误');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.httpStatus).toBe(401);
  });
});
