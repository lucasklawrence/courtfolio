import { expect, type Page } from '@playwright/test'

/** LocalStorage key used to persist whether the visitor has already seen the intro. */
const HAS_SEEN_INTRO_KEY = 'hasSeenIntro'

/** Test ID applied to the post-intro home-court root once it is mounted. */
const HOME_COURT_TEST_ID = 'home-court-root'

/** Maximum time to wait for the home court to mount, in milliseconds. */
const HOME_COURT_READY_TIMEOUT_MS = 30_000

/**
 * Seeds localStorage so the home page skips the tunnel intro animation.
 *
 * @param page - Playwright page that should start on the post-intro court.
 */
export async function bypassHomeIntro(page: Page): Promise<void> {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, 'true')
  }, HAS_SEEN_INTRO_KEY)
}

/**
 * Navigates to `/` and waits for the post-intro home-court root to mount,
 * absorbing dev-server compile time and the framer-motion fade-in so callers
 * can immediately assert against rendered court affordances.
 *
 * Requires {@link bypassHomeIntro} to have run first (typically in `beforeEach`).
 *
 * @param page - Playwright page that has had the intro bypass seeded.
 * @throws If the home-court root is not visible within `HOME_COURT_READY_TIMEOUT_MS`.
 */
export async function gotoHomeCourt(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId(HOME_COURT_TEST_ID)).toBeVisible({
    timeout: HOME_COURT_READY_TIMEOUT_MS,
  })
}
