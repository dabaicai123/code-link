import { defineWorkspace } from 'vitest/config';

// 定义工作区，将容器集成测试与普通测试隔离
export default defineWorkspace([
  // 普通单元测试（可并行）
  {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: [
        'tests/container-manager.test.ts',
        'tests/preview-container.test.ts',
      ],
      globals: false,
      poolOptions: {
        threads: {
          maxThreads: 4,
          minThreads: 1,
        },
      },
      testTimeout: 30000,
      hookTimeout: 30000,
      name: 'unit',
    },
  },
  // 容器集成测试（真实 Docker，串行执行）
  {
    test: {
      include: [
        'tests/container-manager.test.ts',
        'tests/preview-container.test.ts',
      ],
      globals: false,
      // 强制单线程串行执行
      poolOptions: {
        threads: {
          maxThreads: 1,
          minThreads: 1,
        },
        forks: {
          maxForks: 1,
          minForks: 1,
        },
      },
      testTimeout: 180000,
      hookTimeout: 180000,
      // 测试之间顺序执行
      sequence: {
        concurrent: false,
      },
      name: 'container-integration',
    },
  },
]);
