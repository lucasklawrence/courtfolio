import { defineConfig } from '@playwright/test'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3007'
const TRAINING_FACILITY_BASE_URL = 'http://127.0.0.1:3008'
const IS_CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'default-routes',
      testMatch: /(?:home|rooms|training-facility-disabled)\.spec\.ts/,
      use: {
        baseURL: DEFAULT_BASE_URL,
      },
    },
    {
      name: 'training-facility-enabled',
      testMatch: /training-facility-enabled\.spec\.ts/,
      use: {
        baseURL: TRAINING_FACILITY_BASE_URL,
      },
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:dev',
      url: DEFAULT_BASE_URL,
      timeout: 180_000,
      reuseExistingServer: !IS_CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run e2e:dev:training-facility',
      url: TRAINING_FACILITY_BASE_URL,
      timeout: 180_000,
      reuseExistingServer: !IS_CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
