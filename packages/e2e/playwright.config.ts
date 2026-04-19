// packages/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 6, // 更高并行度
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
    // 减少默认超时时间
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  // 限制 expect 超时
  expect: {
    timeout: 5000,
  },

  projects: [
    // 认证 setup project - 创建认证状态供其他测试复用
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
    },
    // 主测试 project - 复用认证状态
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        channel: undefined,
      },
      dependencies: ['setup'],
      testMatch: ['projects.spec.ts', 'collaboration.spec.ts', 'organizations.spec.ts'],
    },
    // 认证测试 project - 不复用认证状态
    {
      name: 'auth-tests',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
      },
      testMatch: 'auth.spec.ts',
      // 并行运行，不需要依赖 setup
    },
  ],
});