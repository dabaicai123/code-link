import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../src/middleware/validation.js';
import { ValidationError } from '../../src/core/errors/index.js';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it('should pass valid body', () => {
      mockReq.body = { name: 'test', age: 25 };
      validateBody(schema)(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({ name: 'test', age: 25 });
    });

    it('should throw ValidationError on invalid body', () => {
      mockReq.body = { name: '', age: -1 };

      expect(() => validateBody(schema)(mockReq as Request, mockRes as Response, mockNext))
        .toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for unknown properties with strict mode', () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      mockReq.body = { name: 'test', unknown: 'field' };

      expect(() => validateBody(strictSchema)(mockReq as Request, mockRes as Response, mockNext))
        .toThrow(ValidationError);
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().regex(/^\d+$/).transform(Number),
    });

    it('should pass valid params and store in validatedParams', () => {
      mockReq.params = { id: '123' };
      validateParams(schema)(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.validatedParams).toEqual({ id: 123 });
    });

    it('should throw ValidationError on invalid params', () => {
      mockReq.params = { id: 'abc' };

      expect(() => validateParams(schema)(mockReq as Request, mockRes as Response, mockNext))
        .toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
    });

    it('should pass valid query with defaults', () => {
      mockReq.query = {};
      validateQuery(schema)(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ page: 1, limit: 10 });
    });

    it('should use provided values', () => {
      mockReq.query = { page: '2', limit: '20' };
      validateQuery(schema)(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ page: 2, limit: 20 });
    });
  });
});