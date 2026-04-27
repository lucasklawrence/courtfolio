import type { Page } from '@playwright/test'

/** LocalStorage key used to persist whether the visitor has already seen the intro. */
const HAS_SEEN_INTRO_KEY = 'hasSeenIntro'

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
