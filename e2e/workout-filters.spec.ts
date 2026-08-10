import { expect, test, type Page } from '@playwright/test'

/**
 * Pins the session log's filter-count contract (#445).
 *
 * A count on a filter chip is a promise about what clicking it returns. The
 * chips used to tally the whole history while the list was filtered, and the
 * year axis defaults to the newest year rather than to everything — so the rail
 * advertised "Apple Health 507" above a list of 22, and clicking "Recorded 15"
 * from the 2026 view landed on an empty page, because every recorded session
 * was in 2022-2024.
 *
 * The assertions walk the chips that are actually rendered rather than naming
 * fixed ones, so this holds against both environments: CI has no Supabase
 * credentials and renders the demo fixture, while a credentialed local run
 * renders 522 real sessions across six years.
 */

const WORKOUTS = '/training-facility/weight-room/workouts'

/**
 * How many sessions the current view actually contains.
 *
 * Reads the paginator's "Showing 1–50 of 507" when the result spans pages, and
 * falls back to counting rendered rows when it doesn't — a single page has no
 * paginator to read.
 */
async function visibleTotal(page: Page): Promise<number> {
  const paginator = page.getByTestId('workout-pagination')
  if ((await paginator.count()) > 0) {
    const text = (await paginator.innerText()).replace(/,/g, '')
    const match = /of\s+(\d+)/.exec(text)
    if (match !== null) return Number(match[1])
  }
  return page.locator('[data-testid^="workout-row-"]').count()
}

/** The number a chip advertises, from its trailing count span. */
async function chipCount(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText()
  const match = /(\d[\d,]*)\s*$/.exec(text.trim())
  expect(match, `chip ${testId} has no trailing count`).not.toBeNull()
  return Number((match as RegExpExecArray)[1].replace(/,/g, ''))
}

/** Test ids of the chips a rail is currently rendering, in document order. */
async function renderedChipIds(
  rail: ReturnType<Page['getByTestId']>,
  prefix: string
): Promise<string[]> {
  return rail
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll(nodes =>
      nodes.map(n => n.getAttribute('data-testid')).filter((id): id is string => id !== null)
    )
}

/**
 * Click a chip and wait for the view it selects to actually be on screen.
 *
 * These are soft navigations, so the DOM keeps serving the previous filter's
 * rows for as long as the RSC render takes — long enough on this route that
 * reading the total straight after the click measures the *old* page. The chip
 * gaining `aria-current` is the signal that the new render landed.
 */
async function clickChip(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click()
  await expect(page.getByTestId(testId)).toHaveAttribute('aria-current', 'page', {
    timeout: 30_000,
  })
}

test.describe('session log filter counts', () => {
  test('every source chip counts what clicking it returns', async ({ page }) => {
    test.slow() // One render per chip, on a route that carries the full history.
    await page.goto(`${WORKOUTS}?preview=demo`)

    const rail = page.getByTestId('workout-source-filter')
    if ((await rail.count()) === 0) {
      // No imported sessions in this environment's data — the rail correctly
      // doesn't exist, and there is nothing to assert.
      test.skip()
      return
    }

    // Enumerated rather than hardcoded: a source that matches nothing under the
    // current year has no chip at all, which is the point.
    const ids = await renderedChipIds(rail, 'workout-source-')

    for (const id of ids) {
      await page.goto(`${WORKOUTS}?preview=demo`)
      const promised = await chipCount(page, id)
      await clickChip(page, id)
      expect(await visibleTotal(page), `${id} promised ${promised}`).toBe(promised)
    }
  })

  test('every year chip counts what clicking it returns', async ({ page }) => {
    test.slow()
    await page.goto(`${WORKOUTS}?preview=demo`)

    const rail = page.getByTestId('workout-year-filter')
    if ((await rail.count()) === 0) {
      test.skip()
      return
    }

    const ids = await renderedChipIds(rail, 'workout-year-')

    for (const id of ids) {
      await page.goto(`${WORKOUTS}?preview=demo`)
      const promised = await chipCount(page, id)
      await clickChip(page, id)
      expect(await visibleTotal(page), `${id} promised ${promised}`).toBe(promised)
    }
  })

  test('the source rail stays reachable from a year it matches nothing in', async ({ page }) => {
    // The rail's *existence* is a fact about the log, not the current view.
    // Gating it on the faceted count would remove the only way to undo a
    // provenance filter that emptied the page.
    await page.goto(`${WORKOUTS}?preview=demo&source=imported`)

    const rail = page.getByTestId('workout-source-filter')
    if ((await rail.count()) === 0) {
      test.skip()
      return
    }
    await expect(rail).toBeVisible()
    await expect(page.getByTestId('workout-source-all')).toBeVisible()
  })

  test('a template chip never offers a year it did not run in', async ({ page }) => {
    // Template chips are dropped when they have nothing under the current year
    // and source, so no chip leads to an empty list.
    await page.goto(`${WORKOUTS}?preview=demo`)

    const chips = page.locator('[data-testid^="workout-filter-"]')
    const count = await chips.count()
    for (let i = 0; i < count; i++) {
      const id = await chips.nth(i).getAttribute('data-testid')
      if (id === null || id === 'workout-filter-all') continue
      expect(await chipCount(page, id)).toBeGreaterThan(0)
    }
  })
})
