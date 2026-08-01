import { expect, test } from '@playwright/test'

/**
 * Pins the #355 / #356 class of bug: a chart that sizes itself from its data
 * must **overflow** its card at phone width so `overflow-x-auto` has something
 * to scroll, and must **not** overflow at desktop width, where a floor above
 * the column width would clip every chart behind a scrollbar instead.
 *
 * Both ends matter, because fixing one end is what broke the other — #355 gave
 * the charts a width floor so they'd scroll on a phone, and #356 had to make
 * that floor breakpoint-aware after it started clipping desktop.
 *
 * Runs in two projects: `training-facility-enabled` (Chromium, 1280) asserts
 * the desktop end, `mobile-webkit` (iPhone 14, 390) the mobile end. The
 * assertions branch on the measured viewport rather than the project name, so
 * adding a third width doesn't need a new branch here.
 *
 * `?preview=demo` supplies the dataset. The e2e job has no Supabase
 * credentials, so without it every chart renders empty and this spec would
 * pass by measuring nothing — hence the explicit "found some charts" guard
 * before any width assertion.
 */

/** Below Tailwind's `lg`, where the chart grid is stacked and cards span the viewport. */
const LG_BREAKPOINT = 1024

test.describe('chart overflow behaviour', () => {
  test('data-sized charts scroll on a phone and fit on desktop', async ({ page }) => {
    await page.goto('/training-facility/weight-room/history?preview=demo')

    const heatmaps = page.getByTestId('weight-room-heatmaps')
    await expect(heatmaps).toBeVisible()

    const measured = await heatmaps.evaluate(section => {
      const boxes = [...section.querySelectorAll<HTMLElement>('.overflow-x-auto')]
      return {
        viewport: window.innerWidth,
        count: boxes.length,
        // A chart "overflows" when its content is wider than the scroll
        // container — the precondition for `overflow-x-auto` to do anything.
        overflowing: boxes.filter(el => el.scrollWidth > el.clientWidth).length,
        widest: boxes.reduce((max, el) => Math.max(max, el.scrollWidth - el.clientWidth), 0),
      }
    })

    // Guard: if the fixture ever stops producing charts, fail loudly rather
    // than silently asserting over an empty list.
    expect(measured.count).toBeGreaterThan(0)

    if (measured.viewport < LG_BREAKPOINT) {
      // #355: at phone width the chart must be wider than its card, or there
      // is nothing to drag and a season of data is crushed into ~330px.
      expect(measured.overflowing).toBeGreaterThan(0)
    } else {
      // #356: at desktop the chart fills its column and must not force a
      // horizontal scrollbar, which would clip its right edge.
      expect(measured.overflowing).toBe(0)
      expect(measured.widest).toBe(0)
    }
  })

  test('the page itself never scrolls horizontally', async ({ page }) => {
    // Distinct from the chart case: a chart is *meant* to scroll inside its
    // card, but the document must not. This is the symptom a reader actually
    // notices — the whole page sliding sideways on a phone.
    await page.goto('/training-facility/weight-room/history?preview=demo')
    await expect(page.getByTestId('weight-room-heatmaps')).toBeVisible()

    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    // One pixel of slack for sub-pixel layout rounding.
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth + 1)
  })
})
