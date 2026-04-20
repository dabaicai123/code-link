import { describe, it, expect } from 'vitest';
import type { User, OrgRole } from '@/types/user';

describe('User types', () => {
  it('User type should have required fields', () => {
    const user: User = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
    };
    expect(user.id).toBe(1);
    expect(user.email).toBe('test@example.com');
  });

  it('OrgRole should be valid role values', () => {
    const roles: OrgRole[] = ['owner', 'developer', 'member'];
    expect(roles).toHaveLength(3);
  });
});
