import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { AuthController } from '../../../src/modules/auth/controller.js';
import { AuthService } from '../../../src/modules/auth/service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let mockService: Partial<AuthService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = {
      register: vi.fn(),
      login: vi.fn(),
      getUser: vi.fn(),
    };

    controller = new AuthController(mockService as AuthService);

    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('register', () => {
    it('should register user and return 201', async () => {
      mockReq.body = { name: 'Test', email: 'test@example.com', password: 'password' };
      (mockService.register as ReturnType<typeof vi.fn>).mockResolvedValue({
        token: 'test-token',
        user: { id: 1, name: 'Test', email: 'test@example.com' },
      });

      await controller.register(mockReq as Request, mockRes as Response);

      expect(mockService.register).toHaveBeenCalledWith({
        name: 'Test',
        email: 'test@example.com',
        password: 'password',
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: {
          token: 'test-token',
          user: { id: 1, name: 'Test', email: 'test@example.com' },
        },
      });
    });
  });

  describe('login', () => {
    it('should login user and return token', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password' };
      (mockService.login as ReturnType<typeof vi.fn>).mockResolvedValue({
        token: 'test-token',
        user: { id: 1, name: 'Test', email: 'test@example.com' },
      });

      await controller.login(mockReq as Request, mockRes as Response);

      expect(mockService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: {
          token: 'test-token',
          user: { id: 1, name: 'Test', email: 'test@example.com' },
        },
      });
    });
  });

  describe('me', () => {
    it('should return current user', async () => {
      mockReq.userId = 1;
      (mockService.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        name: 'Test',
        email: 'test@example.com',
      });

      await controller.me(mockReq as Request, mockRes as Response);

      expect(mockService.getUser).toHaveBeenCalledWith(1);
      expect(jsonMock).toHaveBeenCalledWith({
        code: 0,
        data: { id: 1, name: 'Test', email: 'test@example.com' },
      });
    });

    it('should return 404 for non-existent user', async () => {
      mockReq.userId = 999;
      (mockService.getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await controller.me(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });
});
