import { defineWorkspace } from 'vitest/config';
import swc from 'vite-plugin-swc-transform';

// SWC transform plugin for tsyringe decorator metadata (emitDecoratorMetadata)
// esbuild doesn't support emitDecoratorMetadata, so SWC is needed for DI to work
const swcPlugin = swc({
  swcOptions: {
    jsc: {
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
        useDefineForClassFields: false,
      },
    },
  },
});

export default defineWorkspace([
  // 普通单元测试（默认运行）
  {
    plugins: [swcPlugin],
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: [
        'tests/container-manager.test.ts',
        'tests/preview-container.test.ts',
        'tests/socket/rate-limit.test.ts',
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
    plugins: [swcPlugin],
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