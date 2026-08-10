import { expect, test } from '@playwright/test'

/**
 * Pins the History view's heatmap range toggle (#438).
 *
 * The toggle is a pair of server-resolved links, so the contract worth
 * defending is the URL: switching range must carry the exercise filter across,
 * and the filter chips must carry the range back. Get either wrong and the two
 * controls silently reset each other — which reads as the page losing your
 * place rather than as a bug.
 *
 * Most of that is asserted on the rendered `href`s rather than by clicking.
 * This route is the slowest on the site against real data, and a soft
 * navigation doesn't move the address bar until the RSC payload lands — so a
 * click-per-assertion spec spends a minute proving something the markup already
 * states, and flakes under parallel workers while doing it. One test does
 * navigate, because an href can look correct and still not resolve.
 *
 * Deliberately *not* asserted here: how wide the all-time grid draws. CI has no
 * Supabase credentials and falls through to `?preview=demo`, whose fixture is a
 * couple of weeks of days — so an all-time window there is narrower than the
 * trailing year, and any width assertion would pass by measuring the opposite
 * of the real case. The span arithmetic is unit-tested against a 2022 start in
 * `lib/training-facility/heatmap-span.test.ts` instead, and the one width claim
 * the fixture *can* support — that the document never widens — lives with the
 * rest of that invariant in `chart-overflow.spec.ts`, which also runs on phone
 * WebKit.
 */

const HISTORY = '/training-facility/weight-room/history'

/**
 * Budget for the one assertion that waits on a navigation.
 *
 * `test.slow()` raises the *test* timeout but not `expect`'s, which defaults to
 * 5s — nowhere near a cold all-time render on a dev server under parallel
 * workers. Both have to be raised or the test passes alone and fails in the
 * suite, which reads as a broken link rather than a slow one.
 */
const NAV_TIMEOUT = 60_000

test.describe('heatmap range toggle', () => {
  test('the range links carry the exercise filter', async ({ page }) => {
    await page.goto(`${HISTORY}?preview=demo&exercises=pullups`)

    const toggle = page.getByTestId('heatmap-span-toggle')
    await expect(toggle).toBeVisible()

    // All time adds the param; the trailing year spells itself as the param's
    // absence, so the default view keeps a clean, shareable URL.
    await expect(toggle.getByTestId('heatmap-span-all')).toHaveAttribute(
      'href',
      /exercises=pullups.*span=all|span=all.*exercises=pullups/
    )
    await expect(toggle.getByTestId('heatmap-span-year')).toHaveAttribute(
      'href',
      /exercises=pullups/
    )
    await expect(toggle.getByTestId('heatmap-span-year')).not.toHaveAttribute('href', /span=/)
  })

  test('the exercise chips carry the range back', async ({ page }) => {
    await page.goto(`${HISTORY}?preview=demo&span=all`)

    const chip = page.getByTestId('exercise-chip-pullups')
    await expect(chip).toBeVisible()
    await expect(chip).toHaveAttribute('href', /span=all/)
  })

  test('following the all-time link lands on the all-time view', async ({ page }) => {
    // The one navigation in this spec. An href can read correctly and still not
    // resolve — a query-only `?span=all` looks right in the markup but Next's
    // <Link> won't resolve it against the current route, and only a real click
    // catches that.
    test.slow() // Slowest route on the site; the RSC render dominates.
    await page.goto(`${HISTORY}?preview=demo`)

    await page.getByTestId('heatmap-span-all').click()

    await expect(page).toHaveURL(/span=all/, { timeout: NAV_TIMEOUT })
    await expect(page.getByTestId('weight-room-heatmaps')).toBeVisible()
    await expect(page.getByTestId('heatmap-span-all')).toHaveAttribute('data-selected', 'true')
  })
})
