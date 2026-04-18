import { defineWorkspace } from 'vitest/config';

// 定义工作区，将容器集成测试与普通测试隔离
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
  // 容器集成测试（需要显式运行：npm run test:container）
  // 运行命令：vitest run --project container-integration
  {
    test: {
      include: [
        'tests/container-manager.test.ts',
        'tests/preview-container.test.ts',
      ],
      globals: false,
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 1,
          minThreads: 1,
          singleThread: true,
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
