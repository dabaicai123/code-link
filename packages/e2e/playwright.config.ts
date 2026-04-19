// packages/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI 环境使用较少 workers 保证稳定性，本地使用更多 workers 加速
  workers: process.env.CI ? 2 : 4,
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
    // 收紧超时时间，快速失败
    actionTimeout: 3000,
    navigationTimeout: 8000,
  },
  // 收紧 expect 超时，快速失败
  expect: {
    timeout: 3000,
  },

  projects: [
    // 认证测试 project - 不复用认证状态
    {
      name: 'auth-tests',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
      },
      testMatch: 'auth.spec.ts',
    },
    // 主测试 project - 使用 fixtures 设置认证和 API route
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
      },
      testMatch: ['projects.spec.ts', 'collaboration.spec.ts', 'organizations.spec.ts'],
    },
  ],
});