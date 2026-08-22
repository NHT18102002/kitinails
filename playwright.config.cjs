const { defineConfig } = require('@playwright/test');

const baseURL = process.env.THEME_BASE_URL || 'http://127.0.0.1:9292';

module.exports = defineConfig({
  testDir: './tests/theme/e2e',
  outputDir: './test-results/theme',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.001,
    },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-1440', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'chromium-1024', use: { browserName: 'chromium', viewport: { width: 1024, height: 900 } } },
    { name: 'chromium-768', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } } },
    { name: 'chromium-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'webkit-1440', use: { browserName: 'webkit', viewport: { width: 1440, height: 1000 } } },
    { name: 'webkit-390', use: { browserName: 'webkit', viewport: { width: 390, height: 844 } } },
  ],
});
