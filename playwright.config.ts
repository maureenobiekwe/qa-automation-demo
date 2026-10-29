import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0, // one retry in CI only, and flaky tests get fixed, not hidden
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] }, testDir: './tests/web' },
    // Same flows on a phone-sized browser: ZojaPay users are mostly on mobile.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, testDir: './tests/web' },
    { name: 'api', testDir: './tests/api' },
  ],
});
