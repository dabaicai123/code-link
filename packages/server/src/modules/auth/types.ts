import type { SelectUser } from '../../db/schema/index.js';

export interface AuthResult {
  token: string;
  user: Omit<SelectUser, 'passwordHash'>;
}

export type UserWithoutPassword = Omit<SelectUser, 'passwordHash'>;