import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Shared remote MiniMart: one worker to avoid reset/login races
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./tests/reporters/executive-reporter.ts'],
  ],
  timeout: 60_000,
  use: {
    baseURL: process.env.BASE_URL || 'https://cand1.tail296b14.ts.net',
    trace: 'on-first-retry',
  },
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
  ],
});
