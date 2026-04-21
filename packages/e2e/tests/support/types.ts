// packages/e2e/tests/support/types.ts

export interface TestUser {
  id: number;
  email: string;
  name: string;
}

export interface TestOrganization {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  role: string;
}

export interface TestOrganizationDetail extends TestOrganization {
  members: TestOrganizationMember[];
}

export interface TestOrganizationMember {
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
  joinedAt: string;
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

// Forward declarations for circular dependencies
export type TestApp = import('./test-app').TestApp;
export type TestApi = import('./test-api').TestApi;
