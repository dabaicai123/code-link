import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnection } from '../../src/db/connection.js';
import { createSqliteDb, runMigrations } from '../../src/db/index.js';
import { registerCoreModule } from '../../src/core/core.module.js';
import { registerAuthModule } from '../../src/modules/auth/auth.module.js';
import { registerOrganizationModule } from '../../src/modules/organization/organization.module.js';
import { registerProjectModule } from '../../src/modules/project/project.module.js';
import { registerDraftModule } from '../../src/modules/draft/draft.module.js';
import { registerBuildModule } from '../../src/modules/build/build.module.js';
import { PermissionService } from '../../src/shared/permission.service.js';

/**
 * Register all service modules in the container in the same order as the real app.
 * This ensures circular dependency resolution (delay()) works correctly.
 *
 * Must be called AFTER container.reset() and AFTER DatabaseConnection is registered.
 */
export function registerServiceModules(): void {
  // Same order as src/index.ts:
  // Core → Auth → Organization → Project → Build → Draft
  // PermissionService is registered last (in the real app it's auto-registered by @singleton)
  registerCoreModule();
  registerAuthModule();
  registerOrganizationModule();
  registerProjectModule();
  registerBuildModule();
  registerDraftModule();
  container.registerSingleton(PermissionService);
}

/**
 * Register a minimal set of service modules needed for tests that don't
 * require all modules (e.g. permission tests only need auth + org + project).
 */
export function registerCoreServiceModules(): void {
  registerCoreModule();
  registerAuthModule();
  registerOrganizationModule();
  registerProjectModule();
  container.registerSingleton(PermissionService);
}

/**
 * Full test setup: create in-memory DB, reset container, register DatabaseConnection,
 * then register all service modules.
 *
 * Returns the DatabaseConnection instance for the test to use.
 */
export function setupServiceTestDb(): DatabaseConnection {
  container.reset();

  const sqlite = createSqliteDb(':memory:');
  runMigrations(sqlite);

  const conn = DatabaseConnection.fromSqlite(sqlite);
  container.registerInstance(DatabaseConnection, conn);

  registerServiceModules();

  return conn;
}