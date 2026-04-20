// packages/e2e/tests/support/types.ts
import type Database from 'better-sqlite3';

export interface E2EServerInstance {
  baseUrl: string;
  sqlite: Database.Database;
  close: () => Promise<void>;
}

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

export interface TestOrganization {
  id: number;
  name: string;
  createdBy: number;
}

export interface TestProject {
  id: number;
  name: string;
  organizationId: number;
  status: string;
  createdBy: number;
}

export interface TestInvitation {
  id: number;
  organizationId: number;
  email: string;
  role: string;
  status: string;
}

export interface E2EFixtures {
  app: TestApp;
  db: TestDatabase;
  api: TestApi;
  server: E2EServerInstance;
}

// Forward declarations for circular dependencies
export type TestApp = import('./test-app').TestApp;
export type TestDatabase = import('./database').TestDatabase;
export type TestApi = import('./test-api').TestApi;
