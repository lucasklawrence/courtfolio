import { defineConfig, devices } from '@playwright/test'

/** Base URL for the default route smoke-test project. */
const DEFAULT_BASE_URL = 'http://127.0.0.1:3007'

/** Base URL for the feature-flag-enabled Training Facility smoke-test project. */
const TRAINING_FACILITY_BASE_URL = 'http://127.0.0.1:3008'

/** Whether the Playwright run is executing under CI. */
const IS_CI = /^(1|true)$/i.test(process.env.CI ?? '') || process.env.GITHUB_ACTIONS === 'true'

/**
 * Playwright configuration for route smoke coverage across the default and
 * Training Facility-enabled app states.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  timeout: 60_000,
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
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
      testMatch:
        /(?:home|rooms|project-detail|resume|draft-room-disabled|training-facility-disabled|svg-fragments)\.spec\.ts/,
      use: {
        baseURL: DEFAULT_BASE_URL,
      },
    },
    {
      name: 'training-facility-enabled',
      testMatch:
        /(?:training-facility-enabled|draft-room-enabled|draft-room-live|chart-overflow|heatmap-span|workout-filters|template-detail|eras)\.spec\.ts/,
      use: {
        baseURL: TRAINING_FACILITY_BASE_URL,
      },
    },
    {
      // The engine + viewport gap that let #353 and #355/#356 ship (#359).
      // `iPhone 14` is a WebKit device profile, so one project closes both:
      // WebKit catches engine-level SVG behaviour Chromium papers over, and
      // 390px is the only width where a chart meant to scroll actually does.
      //
      // Deliberately *not* the whole suite under a third browser — the two
      // existing projects already run every route, and a naive cross-product
      // triples e2e wall-clock (CI runs `workers: 1`) to re-assert things that
      // don't vary by engine. This runs only the two specs whose assertions
      // are about rendering.
      name: 'mobile-webkit',
      testMatch: /(?:svg-fragments|chart-overflow|eras)\.spec\.ts/,
      use: {
        ...devices['iPhone 14'],
        // `browserName` must be set explicitly, *after* the device spread.
        // The device descriptor carries `defaultBrowserType: 'webkit'`, but
        // that is only a default — the top-level `use.browserName: 'chromium'`
        // is an explicit value and wins the merge. Without this line the
        // project runs Chromium wearing an iPhone user-agent: the viewport
        // coverage is real, the engine coverage is not, and nothing in the
        // output says so.
        browserName: 'webkit',
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
