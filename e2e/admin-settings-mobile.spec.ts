import { expect, test } from '@playwright/test'

import { ADMIN_BASE_URL, signInAsE2eAdmin, waitForHydration } from './helpers/admin'

/**
 * Weight Room Settings on a phone, as the admin: the page must not
 * scroll sideways, and its controls must be big enough to tap and big enough
 * in text that iOS doesn't zoom when a field takes focus.
 *
 * Runs in `mobile-webkit` against the admin server (e2e admin stub plus the
 * in-memory Supabase fake). Only reads: the write flows are covered by the log
 * spec and the API route tests.
 */

test.use({ baseURL: ADMIN_BASE_URL })
test.describe.configure({ timeout: 120_000 })

const SETTINGS = '/training-facility/weight-room/settings'

/** Minimum touch area on a phone, in CSS pixels. Matches `touch-targets.spec.ts`. */
const MIN_TARGET = 44
/** Smallest field text that doesn't make iOS zoom on focus. */
const MIN_FIELD_TEXT = 16

// No reset: this spec only reads, and resetting would race the log spec's
// writes on a local run with several workers.
test.beforeEach(async ({ context }) => {
  await signInAsE2eAdmin(context)
})

for (const width of [390, 320]) {
  test(`fits a ${width}px screen without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const response = await page.goto(SETTINGS)
    expect(response?.status(), 'settings should render for the stubbed admin').toBe(200)
    await expect(page.getByTestId('weight-room-sub-nav')).toBeVisible()
    await waitForHydration(page, '[data-testid="weight-room-sub-nav"]')

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(innerWidth)
  })
}

test('controls are large enough to tap, and fields too large to zoom', async ({ page }) => {
  await page.goto(SETTINGS)
  await expect(page.getByTestId('weight-room-sub-nav')).toBeVisible()
  await waitForHydration(page, '[data-testid="weight-room-sub-nav"]')

  const controls = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'main button, main input, main select, main textarea'
      ),
    ]
      .filter(el => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return box.width > 1 && box.height > 1 && style.visibility !== 'hidden'
      })
      .map(el => {
        const box = el.getBoundingClientRect()
        return {
          control: `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent ?? ''}`
            .trim()
            .slice(0, 60),
          isField: el.matches('input:not([type=checkbox]):not([type=radio]), select, textarea'),
          isToggle: el.matches('input[type=checkbox], input[type=radio]'),
          height: Math.round(box.height),
          fontSize: parseFloat(getComputedStyle(el).fontSize),
        }
      })
  )

  // Guard: an empty page would pass by measuring nothing.
  expect(controls.length).toBeGreaterThan(5)

  const tooShort = controls.filter(c => !c.isToggle && c.height < MIN_TARGET)
  const zooms = controls.filter(c => c.isField && c.fontSize < MIN_FIELD_TEXT)
  expect(tooShort, 'controls shorter than the touch minimum').toEqual([])
  expect(zooms, 'fields whose text makes iOS zoom on focus').toEqual([])
})
