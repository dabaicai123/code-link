// tests/build-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSqliteDb, closeDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { BuildManager, resetBuildManagerInstance } from '../src/build/build-manager.js';
import { resetWebSocketServerInstance } from '../src/websocket/server.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
} from './helpers/test-db.js';

// Mock dependencies
vi.mock('../src/docker/client.js', () => ({
  getDockerClient: vi.fn(() => ({
    buildImage: vi.fn(() => Promise.resolve({})),
    modem: {
      followProgress: vi.fn((stream, callback) => callback(null, [])),
    },
  })),
}));

vi.mock('../src/docker/volume-manager.js', () => ({
  getVolumePath: vi.fn((projectId: number) => `/volumes/project-${projectId}`),
}));

vi.mock('../src/build/preview-container.js', () => ({
  getPreviewContainerManager: vi.fn(() => ({
    createPreviewContainer: vi.fn(() => Promise.resolve(30001)),
  })),
}));

vi.mock('../src/websocket/server.js', () => ({
  getWebSocketServer: vi.fn(() => null),
  resetWebSocketServerInstance: vi.fn(),
}));

describe('BuildManager', () => {
  let manager: BuildManager;

  beforeEach(() => {
    closeDb();
    getSqliteDb(':memory:');
    initSchema(getSqliteDb());

    const user = createTestUser();
    const org = createTestOrganization(user.id);
    createTestOrganizationMember(org.id, user.id, 'owner', user.id);
    createTestProject(user.id, org.id);

    manager = new BuildManager();
  });

  afterEach(() => {
    resetBuildManagerInstance();
    resetWebSocketServerInstance();
    closeDb();
  });

  it('should create build record', async () => {
    const build = await manager.createBuild(1);

    expect(build.projectId).toBe(1);
    expect(build.status).toBe('pending');
  });

  it('should update build status', async () => {
    const build = await manager.createBuild(1);

    await manager.updateBuildStatus(build.id, 'running');
    const updated = await manager.getBuild(build.id);

    expect(updated?.status).toBe('running');
  });

  it('should get project builds', async () => {
    await manager.createBuild(1);
    await manager.createBuild(1);

    const builds = await manager.getProjectBuilds(1);

    expect(builds.length).toBe(2);
  });

  it('should build from project volume', async () => {
    // 这个测试需要真实容器，这里只测试接口
    const build = await manager.createBuild(1);

    // 模拟构建完成
    await manager.updateBuildStatus(build.id, 'success', 30001);

    const updated = await manager.getBuild(build.id);
    expect(updated?.status).toBe('success');
    expect(updated?.previewPort).toBe(30001);
  });

  it('should get latest build for project', async () => {
    const build1 = await manager.createBuild(1);
    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    const build2 = await manager.createBuild(1);

    const latest = await manager.getLatestBuild(1);
    expect(latest?.id).toBe(build2.id);
  });

  it('should return null for non-existent build', async () => {
    const build = await manager.getBuild(999);
    expect(build).toBeNull();
  });

  it('should return empty array for project with no builds', async () => {
    const builds = await manager.getProjectBuilds(999);
    expect(builds).toEqual([]);
  });

  it('should return null for latest build of non-existent project', async () => {
    const build = await manager.getLatestBuild(999);
    expect(build).toBeNull();
  });
});
