import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration
 *
 * This configuration supports:
 * - Multiple browsers (Chromium, Firefox, WebKit)
 * - Mobile viewport emulation
 * - Parallel test execution
 * - Video recording on failure
 * - Screenshot capture
 * - Test retries
 * - CI/CD integration
 */

export default defineConfig({
  // Test directory
  testDir: './packages/frontend/tests/e2e',

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Test timeout for each assertion
  expect: {
    timeout: 5000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/test-results.json' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for navigating
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Capture screenshot after each test failure
    screenshot: 'only-on-failure',

    // Capture video only when retrying a test for the first time
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Emulate browser locale
    locale: 'en-US',

    // Emulate timezone
    timezoneId: 'America/New_York',

    // Test environment variables
    extraHTTPHeaders: {
      // Add custom headers if needed
    },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Test against branded browsers
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm --filter @klikkflow/frontend dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // 2 minutes to start
        stdout: 'ignore',
        stderr: 'pipe',
      },

  // Global setup/teardown
  // globalSetup: require.resolve('./packages/frontend/tests/e2e/global-setup.ts'),
  // globalTeardown: require.resolve('./packages/frontend/tests/e2e/global-teardown.ts'),
});
