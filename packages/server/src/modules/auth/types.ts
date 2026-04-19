import type { SelectUser } from '../../db/schema/index.js';

export interface AuthResult {
  token: string;
  user: Omit<SelectUser, 'passwordHash'>;
}

export interface UserWithoutPassword extends Omit<SelectUser, 'passwordHash'> {}
