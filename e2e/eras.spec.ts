import { expect, test } from '@playwright/test'

/**
 * Pins the whole-log era view (#437).
 *
 * The route only has something to show when the log contains a long layoff, and
 * CI's demo fixture is a couple of recent weeks — so the interesting assertions
 * are environment-dependent. What holds everywhere: the page renders rather than
 * erroring, it is reachable from History, and it shows exactly one of the two
 * legitimate states (a comparison, or the note explaining there's nothing to
 * compare). The split arithmetic is unit tested in
 * `lib/training-facility/log-eras.test.ts`.
 */

const HISTORY = '/training-facility/weight-room/history'
const ERAS = '/training-facility/weight-room/eras'

/** Budget for a render of History or the eras page under parallel load. */
const RENDER_TIMEOUT = 60_000

test.describe('two eras view', () => {
  test('renders exactly one of its two legitimate states', async ({ page }) => {
    await page.goto(`${ERAS}?preview=demo`)

    const contrast = page.getByTestId('era-contrast')
    const empty = page.getByTestId('era-empty')
    await expect(contrast.or(empty).first()).toBeVisible({ timeout: RENDER_TIMEOUT })

    const hasContrast = (await contrast.count()) > 0
    const hasEmpty = (await empty.count()) > 0
    // Never both: a log either has a layoff to split on or it doesn't.
    expect(hasContrast).not.toBe(hasEmpty)

    if (hasContrast) {
      // The cadence chart only exists alongside a real split.
      await expect(page.getByTestId('era-cadence')).toBeVisible()
      // Every roster bucket is stated, including the empty ones.
      await expect(page.getByTestId('era-roster-shared')).toBeVisible()
      await expect(page.getByTestId('era-roster-then-only')).toBeVisible()
      await expect(page.getByTestId('era-roster-now-only')).toBeVisible()
    }
  })

  test('is reachable from History', async ({ page }) => {
    test.slow() // History is one of the heavier renders in the app.
    await page.goto(`${HISTORY}?preview=demo`)

    const link = page.getByTestId('eras-link')
    await expect(link).toBeVisible({ timeout: RENDER_TIMEOUT })
    const href = await link.getAttribute('href')
    expect(href).toContain(ERAS)
  })

  test('does not widen the document', async ({ page }) => {
    // The cadence chart spans five years of months and is meant to scroll
    // inside its own card.
    await page.goto(`${ERAS}?preview=demo`)
    await expect(
      page.getByTestId('era-contrast').or(page.getByTestId('era-empty')).first()
    ).toBeVisible({ timeout: RENDER_TIMEOUT })

    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth + 1)
  })
})
