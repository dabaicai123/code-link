import { describe, it, expect, beforeAll } from 'vitest';
import { getDockerClient } from '../src/docker/client.ts';

describe('Docker Client', () => {
  it('should return a valid Docker instance', () => {
    const docker = getDockerClient();
    expect(docker).toBeDefined();
    expect(docker.version).toBeDefined();
  });

  it('should return the same instance on multiple calls', () => {
    const docker1 = getDockerClient();
    const docker2 = getDockerClient();
    expect(docker1).toBe(docker2);
  });
});
