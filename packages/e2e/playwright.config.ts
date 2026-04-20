// packages/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory - journey tests
  testDir: './tests/journeys',

  // Sequential execution for data consistency
  fullyParallel: false,
  workers: 1,

  // Fail build on .only in CI
  forbidOnly: !!process.env.CI,

  // Retry in CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],

  // Global setup/teardown
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  // Test configuration
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,

    // Browser launch options
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ],
    },

    // Tighter timeouts for faster failure
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Test projects
  projects: [
    {
      name: 'journeys',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: '**/*.journey.ts',
    },
  ],
});