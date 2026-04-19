import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

describe('requestIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      setHeader: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should generate request ID if not provided', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).requestId).toBeDefined();
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      (mockReq as any).requestId
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use provided request ID from header', () => {
    mockReq.headers = { 'x-request-id': 'provided-id' };
    
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).requestId).toBe('provided-id');
    expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', 'provided-id');
  });

  it('should generate valid UUID format', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const uuid = (mockReq as any).requestId;
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
