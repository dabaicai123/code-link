import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionService } from '../src/services/permission.service.js';
import { PermissionError, NotFoundError } from '../src/utils/errors.js';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService();
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