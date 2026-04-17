// tests/volume-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProjectVolume, removeProjectVolume, getVolumePath } from '../src/docker/volume-manager.ts';
import fs from 'fs/promises';
import path from 'path';

describe('Volume Manager', () => {
  const testProjectId = 9999;

  afterEach(async () => {
    try {
      await removeProjectVolume(testProjectId);
    } catch {}
  });

  it('should create a volume directory for a project', async () => {
    const volumePath = await createProjectVolume(testProjectId);
    expect(volumePath).toBeDefined();

    const stat = await fs.stat(volumePath);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should return the correct volume path', () => {
    const path = getVolumePath(testProjectId);
    expect(path).toMatch(/volumes\/project-9999$/);
  });

  it('should remove a volume directory', async () => {
    const volumePath = await createProjectVolume(testProjectId);
    await removeProjectVolume(testProjectId);

    try {
      await fs.stat(volumePath);
      expect.fail('Volume should be removed');
    } catch (error: any) {
      expect(error.code).toBe('ENOENT');
    }
  });
});
