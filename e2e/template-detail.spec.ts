import { expect, test } from '@playwright/test'

/**
 * Pins the per-template view (#446).
 *
 * The route resolves its `[slug]` by slugifying template names at request time
 * — there is no slug column — so the things worth guarding are that the address
 * works at all, that a bad one 404s rather than rendering an empty shell, and
 * that the charts stay inside their cards. The aggregation itself is unit
 * tested in `lib/training-facility/template-history.test.ts`.
 *
 * Deliberately one navigation test rather than three. Reaching this page means
 * rendering the all-years session log and then the template itself — two of the
 * heaviest renders in the app — and repeating that per assertion pushed the
 * suite past its budget under parallel workers without covering anything new.
 *
 * CI has no Supabase credentials and falls through to `?preview=demo`, whose
 * fixture carries one template. The spec discovers the template from the
 * session log rather than naming one, so it holds in both environments.
 */

const WORKOUTS = '/training-facility/weight-room/workouts'
const TEMPLATES = '/training-facility/weight-room/templates'

/** Budget for a render of the session log or the template page under load. */
const RENDER_TIMEOUT = 60_000

test.describe('per-template view', () => {
  test('is reachable from the session log and keeps its charts inside the page', async ({
    page,
  }) => {
    test.slow() // Two of the heaviest renders in the app, back to back.

    // All years, because templates only ran in past years — the default view
    // faceting (#445) correctly offers no template chips for the current one.
    await page.goto(`${WORKOUTS}?preview=demo&year=all`)

    const ids = await page
      .locator('[data-testid^="workout-filter-"]')
      .evaluateAll(nodes =>
        nodes
          .map(n => n.getAttribute('data-testid'))
          .filter((id): id is string => id !== null && id !== 'workout-filter-all')
      )
    if (ids.length === 0) {
      // No template has been run in this environment's data — nothing to link.
      test.skip()
      return
    }

    // Re-entered by URL rather than by clicking the chip, then followed by
    // `goto` rather than by clicking the link. Both are soft navigations, and
    // chaining two of the heaviest renders in the app through them exceeded the
    // budget under parallel workers — while proving nothing the href and a
    // direct load don't.
    const templateId = ids[0].replace('workout-filter-', '')
    await page.goto(`${WORKOUTS}?preview=demo&year=all&template=${templateId}`)

    const link = page.getByTestId('template-trends-link')
    await expect(link).toBeVisible({ timeout: RENDER_TIMEOUT })
    const href = await link.getAttribute('href')
    expect(href).toContain(`${TEMPLATES}/`)

    await page.goto(href as string)
    await expect(page.getByTestId('template-composition')).toBeVisible({
      timeout: RENDER_TIMEOUT,
    })

    // A chart is meant to scroll inside its own card; the document must not.
    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth + 1)
  })

  test('404s on a template that does not exist', async ({ page }) => {
    const response = await page.goto(`${TEMPLATES}/not-a-real-workout?preview=demo`)
    expect(response?.status()).toBe(404)
  })
})
