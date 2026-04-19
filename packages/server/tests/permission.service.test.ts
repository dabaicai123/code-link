import "reflect-metadata";
import { container } from "tsyringe";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PermissionService } from '../src/services/permission.service.js';
import { PermissionError, NotFoundError } from '../src/utils/errors.js';
import { UserRepository, OrganizationRepository, ProjectRepository } from '../src/repositories/index.js';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    container.reset();
    service = container.resolve(PermissionService);
  });

  afterEach(() => {
    container.reset();
  });

  it('should throw PermissionError when user is not org member', async () => {
    await expect(service.checkOrgRole(99999, 1, 'member'))
      .rejects.toThrow(PermissionError);
  });

  it('should throw NotFoundError when project does not exist', async () => {
    await expect(service.checkProjectAccess(1, 99999))
      .rejects.toThrow(NotFoundError);
  });
});