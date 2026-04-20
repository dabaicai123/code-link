// packages/e2e/tests/support/factories/organization.factory.ts
export interface OrganizationParams {
  name?: string;
}

export function createOrganizationParams(overrides?: OrganizationParams): Required<OrganizationParams> {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    name: overrides?.name ?? `Test Org ${id.slice(0, 4)}`,
  };
}