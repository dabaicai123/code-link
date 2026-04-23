import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnection } from '../../src/db/connection.js';
import { createSqliteDb, runMigrations } from '../../src/db/index.js';
import { registerCoreModule } from '../../src/core/core.module.js';
import { registerAuthModule } from '../../src/modules/auth/auth.module.js';
import { registerOrganizationModule, resetOrganizationServiceCache } from '../../src/modules/organization/organization.module.js';
import { registerProjectModule, resetProjectServiceCache } from '../../src/modules/project/project.module.js';
import { registerDraftModule, resetDraftServiceCache } from '../../src/modules/draft/draft.module.js';
import { registerBuildModule, resetBuildServiceCache } from '../../src/modules/build/build.module.js';
import { resetContainerServiceCache } from '../../src/modules/container/container.module.js';
import { resetCodeServiceCache } from '../../src/modules/code/code.module.js';
import { PermissionService, resetPermissionServiceCache } from '../../src/shared/permission.service.js';

/**
 * Reset lazy getter caches that survive container.reset().
 * Must be called BEFORE container.reset() in tests.
 */
export function resetLazyGetterCaches(): void {
  resetOrganizationServiceCache();
  resetProjectServiceCache();
  resetPermissionServiceCache();
  resetBuildServiceCache();
  resetDraftServiceCache();
  resetContainerServiceCache();
  resetCodeServiceCache();
}

/**
 * Register all service modules in the container in the same order as the real app.
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
  resetLazyGetterCaches();
  container.reset();

  const sqlite = createSqliteDb(':memory:');
  runMigrations(sqlite);

  const conn = DatabaseConnection.fromSqlite(sqlite);
  container.registerInstance(DatabaseConnection, conn);

  registerServiceModules();

  return conn;
}