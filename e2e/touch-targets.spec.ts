import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Pins phone sizing: form text large enough that iOS doesn't zoom, controls large
 * enough to tap, and a Locker Room title that fits on screen. A desktop test pins
 * that none of it leaks up past the phone layout.
 *
 * Runs in `mobile-webkit` and `training-facility-enabled`, branching on the
 * viewport. `?preview=demo` supplies data where the route supports it, since the
 * e2e job has no Supabase credentials. Routes that need credentials to draw their
 * controls can't be measured here.
 *
 * Nothing inside an SVG scene is measured, because a scene scales its contents.
 * A test pins that the sizing rules leave those controls alone. Links inside a line
 * of text aren't measured either, since they have to stay inline to read as text.
 */

/** Routes with controls that render without credentials, and what to wait for on each. */
const ROUTES: readonly { path: string; ready: (page: Page) => Locator }[] = [
  {
    path: '/training-facility/gym/overview?preview=demo',
    ready: page => page.getByLabel('Start date'),
  },
  {
    path: '/training-facility/weight-room/history?preview=demo',
    ready: page => page.getByTestId('heatmap-span-toggle'),
  },
  {
    path: '/training-facility/weight-room/workouts?preview=demo',
    ready: page => page.getByTestId('workout-history'),
  },
]

/** Below Tailwind's `lg`, where touch sizing applies. */
const LG_BREAKPOINT = 1024
/** Minimum touch area on a phone, in CSS pixels. */
const MIN_TARGET = 44
/** Smallest text that doesn't make iOS zoom when a field takes focus. */
const MIN_FIELD_TEXT = 16
/** The routes render slowly on a cold dev server. */
const LOAD_TIMEOUT = 60_000

test.describe.configure({ timeout: 3 * LOAD_TIMEOUT })

/** One control's measurements, also used as the failure message. */
interface MeasuredControl {
  control: string
  isField: boolean
  height: number
  width: number
  fontSize: number
}

/** Every visible control on the page that isn't exempt from the target size. */
async function measureControls(page: Page): Promise<MeasuredControl[]> {
  return page.evaluate(() => {
    const selector = 'a, button, input, select, textarea, summary'
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(el => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        if (box.width <= 1 || box.height <= 1 || style.visibility === 'hidden') return false
        return el.closest('svg') === null && style.display !== 'inline'
      })
      .map(el => {
        const box = el.getBoundingClientRect()
        return {
          control: `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent ?? ''}`.trim(),
          isField: el.matches('input, select, textarea'),
          height: Math.round(box.height),
          width: Math.round(box.width),
          fontSize: parseFloat(getComputedStyle(el).fontSize),
        }
      })
  })
}

test.describe('touch sizing', () => {
  for (const { path, ready } of ROUTES) {
    test(`controls on ${path} are large enough on a phone`, async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT, 'Phone layout only')
      await page.goto(path, { timeout: LOAD_TIMEOUT })
      await expect(ready(page)).toBeVisible({ timeout: LOAD_TIMEOUT })

      const controls = await measureControls(page)
      expect(controls.length).toBeGreaterThan(0)

      expect(controls.filter(c => c.height < MIN_TARGET || c.width < MIN_TARGET)).toEqual([])
      expect(controls.filter(c => c.isField && c.fontSize < MIN_FIELD_TEXT)).toEqual([])
    })
  }

  test('the sizing rules leave controls in an SVG scene alone', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT, 'Phone layout only')
    await page.goto('/locker-room', { timeout: LOAD_TIMEOUT })

    const link = page.locator('foreignObject').getByRole('link', { name: /home court/i })
    await expect(link).toBeAttached({ timeout: LOAD_TIMEOUT })
    // Many zones are too short for a 44px control, and `foreignObject` clips overflow.
    const minHeight = await link.evaluate(el => getComputedStyle(el).minHeight)
    expect(['auto', '0px']).toContain(minHeight)
  })

  test('the date filter keeps its density on desktop', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < LG_BREAKPOINT, 'Desktop layout only')
    await page.goto('/training-facility/gym/overview?preview=demo', { timeout: LOAD_TIMEOUT })

    const start = page.getByLabel('Start date')
    await expect(start).toBeVisible({ timeout: LOAD_TIMEOUT })
    expect(await start.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(12)

    const preset = await page.getByRole('radio', { name: '1M' }).boundingBox()
    expect(preset?.height).toBeLessThan(MIN_TARGET)
  })
})

test.describe('Locker Room title', () => {
  test('is fully on screen at 320px', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT, 'Phone layout only')
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/locker-room', { timeout: LOAD_TIMEOUT })

    const title = page.getByRole('heading', { name: /locker room - select an item/i })
    await expect(title).toHaveCount(1)
    await expect(title.locator('span')).toBeVisible({ timeout: LOAD_TIMEOUT })

    const range = await title.evaluate(el => {
      const measure = document.createRange()
      measure.selectNodeContents(el)
      const box = measure.getBoundingClientRect()
      return { left: box.left, right: box.right, viewport: window.innerWidth }
    })
    expect(range.left).toBeGreaterThanOrEqual(0)
    expect(range.right).toBeLessThanOrEqual(range.viewport)
  })

  test('stays on screen after the scene is scrolled sideways', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT, 'Phone layout only')
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/locker-room', { timeout: LOAD_TIMEOUT })

    const title = page.getByRole('heading', { name: /locker room - select an item/i })
    await expect(title.locator('span')).toBeVisible({ timeout: LOAD_TIMEOUT })

    await title.evaluate(el => {
      let parent = el.parentElement
      while (parent !== null && parent.scrollWidth <= parent.clientWidth) {
        parent = parent.parentElement
      }
      if (parent === null) throw new Error('The scene has no horizontal scroller')
      parent.scrollLeft = 300
    })

    await expect
      .poll(() => title.evaluate(el => el.getBoundingClientRect().left))
      .toBeGreaterThanOrEqual(0)
  })

  test('keeps the in-scene title on desktop', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < LG_BREAKPOINT, 'Desktop layout only')
    await page.goto('/locker-room', { timeout: LOAD_TIMEOUT })

    const title = page.getByRole('heading', { name: /locker room - select an item/i })
    await expect(title).toHaveCount(1)
    await expect(title.locator('xpath=ancestor::*[local-name()="svg"]')).toHaveCount(1)
  })
})
