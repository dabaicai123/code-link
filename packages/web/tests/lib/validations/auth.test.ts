import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validations/auth';

describe('auth validations', () => {
  describe('loginSchema', () => {
    it('validates correct email and password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts short password for login', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'abc',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('validates correct registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'T',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: '123',
      });
      expect(result.success).toBe(false);
    });
  });
});
