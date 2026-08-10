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

  test('keeps the cadence chart inside its own scroller', async ({ page }) => {
    // Measured on the card's scroll container, not the document: this page's
    // root carries `overflow-hidden`, so `documentElement.scrollWidth` can
    // never exceed its client width and a document-level assertion here passes
    // no matter how badly the chart overflows.
    await page.goto(`${ERAS}?preview=demo`)
    const cadence = page.getByTestId('era-cadence')
    if ((await cadence.count()) === 0) {
      // No layoff in this environment's data, so no chart to measure.
      test.skip()
      return
    }
    await expect(cadence).toBeVisible({ timeout: RENDER_TIMEOUT })

    const measured = await cadence.evaluate(section => {
      const scroller = section.querySelector<HTMLElement>('.overflow-x-auto')
      const svg = section.querySelector('svg')
      return {
        viewport: window.innerWidth,
        hasScroller: scroller !== null,
        scrollWidth: scroller?.scrollWidth ?? 0,
        clientWidth: scroller?.clientWidth ?? 0,
        svgWidth: Number(svg?.getAttribute('width') ?? 0),
        sectionRight: section.getBoundingClientRect().right,
      }
    })

    // The chart is a fixed-width SVG; the card is what scrolls it.
    expect(measured.hasScroller).toBe(true)
    expect(measured.svgWidth).toBeGreaterThan(0)
    // The card itself never escapes the viewport, whatever the SVG measures.
    expect(measured.sectionRight).toBeLessThanOrEqual(measured.viewport + 1)
    if (measured.svgWidth > measured.clientWidth) {
      // Wider than its container means the scroller has something to scroll —
      // the precondition for `overflow-x-auto` to do anything.
      expect(measured.scrollWidth).toBeGreaterThan(measured.clientWidth)
    }
  })
})
