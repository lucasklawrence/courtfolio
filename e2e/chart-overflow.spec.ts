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

  test('the all-time range never renders smaller than the default (#438)', async ({ page }) => {
    // Two full renders of the slowest route on the site, one of them all-time.
    test.slow()
    // The bug: the window start came from the data while the cell size came
    // from the span *name*, so on a log shorter than a year "All time" drew a
    // two-column sliver of 6px cells — narrower and less legible than the view
    // it replaced, and narrow enough to clip the legend out of the SVG.
    //
    // Width, not equality, and not height: all-time is deliberately *shorter*
    // (seven rows of 6px beats seven of 14px) while being much wider. Width is
    // the axis the range actually widens, and "never narrower" is the one claim
    // that holds in both environments — CI renders the ~9-day demo fixture,
    // where all-time correctly collapses to the default, while a credentialed
    // local run renders four real years.
    const widthOf = async (url: string): Promise<number> => {
      await page.goto(url)
      await expect(page.getByTestId('weight-room-heatmaps')).toBeVisible()
      return page
        .getByRole('img', { name: 'Pushups heatmap' })
        .evaluate(svg => Number(svg.getAttribute('width')))
    }

    const base = '/training-facility/weight-room/history?preview=demo'
    const year = await widthOf(base)
    const all = await widthOf(`${base}&span=all`)

    expect(year).toBeGreaterThan(0)
    expect(all).toBeGreaterThanOrEqual(year)
  })

  test('the per-exercise trend keeps its charts inside the page', async ({ page }) => {
    // The trend panels (#412) are fixed-width SVGs — 760px, wider than a phone —
    // so they carry the same two obligations: scroll inside their own card, and
    // never widen the document.
    //
    // Pull-ups specifically, because it's the one movement that resolves in both
    // environments: CI has no Supabase credentials and falls through to the
    // fixture, while a local run has real credentials — which *suppresses* the
    // fixture — and has to find real pull-up sets instead. A demo-only movement
    // renders the empty state locally and the assertion never runs.
    //
    // Slow for the same reason: on real data this route's render was already
    // near the default budget, and the all-time cases added alongside it (#438)
    // compete for the same dev server.
    test.slow()
    await page.goto('/training-facility/weight-room/exercises/pullups?preview=demo')
    await expect(page.getByTestId('exercise-progression-pullups')).toBeVisible()

    // Scoped to the panel: an unrelated scroller elsewhere on the page would
    // otherwise satisfy the overflow assertion while the trend charts sat
    // squashed inside their cards.
    const panel = page.getByTestId('exercise-progression-pullups')
    const measured = await panel.evaluate(root => ({
      viewport: window.innerWidth,
      count: root.querySelectorAll('.overflow-x-auto').length,
      overflowing: [...root.querySelectorAll<HTMLElement>('.overflow-x-auto')].filter(
        el => el.scrollWidth > el.clientWidth
      ).length,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    }))

    expect(measured.count).toBeGreaterThan(0)
    if (measured.viewport < LG_BREAKPOINT) {
      expect(measured.overflowing).toBeGreaterThan(0)
    }
    expect(measured.docScrollWidth).toBeLessThanOrEqual(measured.docClientWidth + 1)
  })
})
