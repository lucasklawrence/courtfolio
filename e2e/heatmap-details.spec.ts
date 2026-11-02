import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Pins touch and keyboard access to heatmap day details.
 *
 * Runs in two projects: `mobile-webkit` (iPhone 14) taps real cells, and
 * `training-facility-enabled` (Chromium, 1280) covers the keyboard, the desktop
 * tooltip, and the pan test, which needs Chromium's DevTools protocol to send a
 * real touch gesture.
 *
 * `?preview=demo` supplies the dataset, since the e2e job has no Supabase
 * credentials. That limits this spec to the per-exercise heatmaps: the fixture has
 * no focus rotations, and the Cardio Overview shows its load error without
 * credentials. Component tests cover tapping those two heatmaps instead.
 */

const HISTORY = '/training-facility/weight-room/history?preview=demo'
const HINT = 'Select a day to see its breakdown.'

/** The route renders slowly on a cold dev server, so allow for a long first load. */
const LOAD_TIMEOUT = 60_000

// History is the slowest route on the site, and page.goto counts against the test.
test.describe.configure({ timeout: 3 * LOAD_TIMEOUT })

/**
 * Wait until React has attached the inspector's handlers. The grid is
 * server-rendered, so it is visible before a tap or key press can do anything,
 * and a cold dev server can leave that gap open for several seconds.
 */
async function hydrated(inspector: Locator): Promise<Locator> {
  await expect(inspector).toBeVisible({ timeout: LOAD_TIMEOUT })
  await expect
    .poll(
      () =>
        inspector
          .getByRole('group')
          .evaluate(el => Object.keys(el).some(key => key.startsWith('__reactProps'))),
      { timeout: LOAD_TIMEOUT }
    )
    .toBe(true)
  return inspector
}

/** The first exercise's inspector, ready for input. */
async function firstInspector(page: Page): Promise<Locator> {
  await page.goto(HISTORY)
  return hydrated(page.getByTestId('weight-room-heatmaps').getByTestId('heatmap-inspector').first())
}

/** The cell at a grid position. */
function cellOf(inspector: Locator, col: number, row: number): Locator {
  return inspector.locator(`rect[data-col="${col}"][data-row="${row}"]`)
}

/** The tooltip text a cell carries, which the readout has to match exactly. */
async function titleOf(cell: Locator): Promise<string> {
  return (await cell.locator('title').textContent()) ?? ''
}

test.describe('heatmap day details on touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch only')

  test('tapping a cell shows its details and tapping elsewhere dismisses them', async ({
    page,
  }) => {
    const inspector = await firstInspector(page)
    const readout = inspector.getByTestId('heatmap-cell-detail')
    await expect(readout).toHaveText(HINT)

    const cell = cellOf(inspector, 20, 3)
    const expected = await titleOf(cell)
    expect(expected).not.toBe('')

    await cell.tap()
    await expect(readout).toHaveText(expected)

    await page.getByRole('heading', { name: 'Heatmap & stats' }).tap()
    await expect(readout).toHaveText(HINT)
  })

  test('cells can be told apart by tap at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    const inspector = await firstInspector(page)
    const readout = inspector.getByTestId('heatmap-cell-detail')

    const first = cellOf(inspector, 20, 3)
    const second = cellOf(inspector, 21, 3)
    await first.tap()
    await expect(readout).toHaveText(await titleOf(first))
    await second.tap()
    await expect(readout).toHaveText(await titleOf(second))

    // The readout has to wrap inside the phone's width rather than widen the page.
    const widened = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(widened).toBe(false)
  })
})

test.describe('heatmap day details on desktop', () => {
  test.skip(({ hasTouch }) => hasTouch, 'Desktop only')

  test('every cell keeps its native hover tooltip', async ({ page }) => {
    const inspector = await firstInspector(page)
    const cell = cellOf(inspector, 20, 3)
    await cell.hover()
    expect(await titleOf(cell)).not.toBe('')
    expect(await inspector.locator('rect[data-col]:not(:has(title))').count()).toBe(0)
  })

  test('the keyboard reaches the same details', async ({ page }) => {
    const inspector = await firstInspector(page)
    const readout = inspector.getByTestId('heatmap-cell-detail')
    const grid = inspector.getByRole('group')

    await grid.focus()
    await page.keyboard.press('ArrowDown')
    const selected = inspector.locator('[data-heatmap-selected]')
    await expect(selected).toHaveCount(1)
    await expect(readout).toHaveText(await titleOf(selected))
    // The inspector's text color, drawn as the selected cell's outline.
    await expect(selected).toHaveCSS('stroke', 'rgb(232, 213, 190)')

    await page.keyboard.press('ArrowLeft')
    await expect(readout).toHaveText(await titleOf(selected))

    await page.keyboard.press('Escape')
    await expect(readout).toHaveText(HINT)
  })
})

test.describe('heatmap scrolling', () => {
  // Chromium's touch emulation, at phone width so the grid actually overflows.
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('a horizontal pan across the grid opens nothing', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Needs the DevTools protocol')

    const inspector = await firstInspector(page)
    const scroller = inspector.locator('.overflow-x-auto')
    // The gesture has to start inside the viewport, and the grid can load below it.
    await scroller.scrollIntoViewIfNeeded()
    const box = await scroller.boundingBox()
    if (box === null) throw new Error('The heatmap scroller has no box')

    const readout = inspector.getByTestId('heatmap-cell-detail')
    const x = box.x + box.width * 0.75
    const y = box.y + box.height / 2
    const client = await page.context().newCDPSession(page)
    /** Press at `x`, drag left by `distance` in small steps, and release. */
    const touch = async (distance: number) => {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      })
      for (let moved = 20; moved <= distance; moved += 20) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x - moved, y }],
        })
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }

    // The same touch without the drag does open details, so the pan's result
    // below can't come from these events simply not reaching the grid. This goes
    // first because a tap during a pan's momentum only stops the scroll.
    await touch(0)
    await expect(readout).not.toHaveText(HINT)
    await touch(0)
    await expect(readout).toHaveText(HINT)

    await touch(160)
    await expect
      .poll(() => scroller.evaluate(el => el.scrollLeft), { message: 'the pan has to scroll' })
      .toBeGreaterThan(0)
    await expect(readout).toHaveText(HINT)
    await expect(inspector.locator('[data-heatmap-selected]')).toHaveCount(0)
  })
})
