import { expect, test, type Page } from '@playwright/test'

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
 * Illustrated scene hotspots aren't measured, and neither are links inside a line
 * of text, which have to stay inline to read as text.
 */

/** Routes with controls that render without credentials. */
const ROUTES = [
  '/training-facility/gym/overview?preview=demo',
  '/training-facility/weight-room/history?preview=demo',
  '/training-facility/weight-room/workouts?preview=demo',
] as const

/** Below Tailwind's `lg`, where touch sizing applies. */
const LG_BREAKPOINT = 1024
/** Minimum touch area on a phone, in CSS pixels. */
const MIN_TARGET = 44
/** Smallest text that doesn't make iOS zoom when a field takes focus. */
const MIN_FIELD_TEXT = 16
/** The routes render slowly on a cold dev server. */
const LOAD_TIMEOUT = 60_000

test.describe.configure({ timeout: 3 * LOAD_TIMEOUT })

/** One control that broke a sizing rule, described for the failure message. */
interface Offender {
  control: string
  height: number
  width: number
  fontSize: number
}

/** Every visible control on the page that isn't exempt from the target size. */
async function measureControls(page: Page): Promise<Offender[]> {
  return page.evaluate(() => {
    const selector = 'a, button, input, select, textarea, summary'
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(el => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        if (box.width <= 1 || box.height <= 1 || style.visibility === 'hidden') return false
        // Scene hotspots are `<a>` inside the SVG, and an inline link is prose.
        return el.closest('svg') === null && style.display !== 'inline'
      })
      .map(el => {
        const box = el.getBoundingClientRect()
        return {
          control: `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent ?? ''}`.trim(),
          height: Math.round(box.height),
          width: Math.round(box.width),
          fontSize: parseFloat(getComputedStyle(el).fontSize),
        }
      })
  })
}

/** Wait for a route's date filter, chips or list before measuring it. */
async function load(page: Page, route: string): Promise<void> {
  await page.goto(route, { timeout: LOAD_TIMEOUT })
  await expect(page.getByRole('link', { name: /home court/i }).first()).toBeVisible({
    timeout: LOAD_TIMEOUT,
  })
}

test.describe('touch sizing', () => {
  for (const route of ROUTES) {
    test(`controls on ${route} are large enough on a phone`, async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT, 'Phone layout only')
      await load(page, route)

      const controls = await measureControls(page)
      expect(controls.length).toBeGreaterThan(0)

      const small = controls.filter(c => c.height < MIN_TARGET || c.width < MIN_TARGET)
      expect(small).toEqual([])
    })
  }

  test('date fields use text iOS will not zoom on', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT, 'Phone layout only')
    await load(page, '/training-facility/gym/overview?preview=demo')

    const start = page.getByLabel('Start date')
    await expect(start).toBeVisible()
    const fontSize = await start.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(MIN_FIELD_TEXT)
  })

  test('the date filter keeps its density on desktop', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < LG_BREAKPOINT, 'Desktop layout only')
    await load(page, '/training-facility/gym/overview?preview=demo')

    const start = page.getByLabel('Start date')
    await expect(start).toBeVisible()
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
    await expect(title).toBeVisible({ timeout: LOAD_TIMEOUT })

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
    await expect(title).toBeVisible({ timeout: LOAD_TIMEOUT })

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
