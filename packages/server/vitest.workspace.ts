import { defineWorkspace } from 'vitest/config';

// 使用 forks 模式减少内存占用，每个测试文件在独立进程中运行
// 限制并行数为 2，降低资源占用
export default defineWorkspace([
  // 普通单元测试（默认运行）
  {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: [
        'tests/container-manager.test.ts',
        'tests/preview-container.test.ts',
      ],
      globals: false,
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 2,
          minForks: 1,
        },
      },
      testTimeout: 30000,
      hookTimeout: 30000,
      name: 'unit',
    },
  },
  // 容器集成测试（需要显式运行：npm run test:container）
  {
    test: {
      include: [
        'tests/container-manager.test.ts',
        'tests/preview-container.test.ts',
      ],
      globals: false,
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 1,
          minForks: 1,
          singleFork: true,
        },
      },
      testTimeout: 180000,
      hookTimeout: 180000,
      sequence: {
        concurrent: false,
      },
      fileParallelism: false,
      name: 'container-integration',
    },
  },
]);