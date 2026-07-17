import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Shared remote MiniMart: one worker to avoid reset/login races
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
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
  ],
});
