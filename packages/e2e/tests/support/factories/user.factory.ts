// packages/e2e/tests/support/factories/user.factory.ts
export interface UserParams {
  email?: string;
  name?: string;
  password?: string;
}

export function createUserParams(overrides?: UserParams): Required<UserParams> {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    email: overrides?.email ?? `user-${id}@test.com`,
    name: overrides?.name ?? `Test User ${id.slice(0, 4)}`,
    password: overrides?.password ?? 'password123',
  };
}