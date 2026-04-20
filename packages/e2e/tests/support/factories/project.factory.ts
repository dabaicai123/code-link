// packages/e2e/tests/support/factories/project.factory.ts
export interface ProjectParams {
  name?: string;
  organizationId?: number;
}

export function createProjectParams(overrides?: ProjectParams): Required<ProjectParams> {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    name: overrides?.name ?? `Test Project ${id.slice(0, 4)}`,
    organizationId: overrides?.organizationId ?? 1,
  };
}
