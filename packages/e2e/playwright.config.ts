// packages/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // 测试服务器共享，不能并行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 单进程，避免数据库冲突
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
    // 认证测试 project - 不复用认证状态，每个测试独立登录
    {
      name: 'auth-tests',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
      },
      testMatch: 'auth.spec.ts',
    },
  ],
});