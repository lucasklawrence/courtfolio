import { expect, test } from '@playwright/test'

/**
 * Pins the Today page's readability on a phone. The scene's wall fixture draws
 * its text at about a quarter of its size at phone width, so below `lg` the same
 * board has to appear as page content, and the unreadable wall tallies have to
 * go. From `lg` the page stays the full-bleed scene it was designed as.
 *
 * Runs in `training-facility-enabled` (Chromium, 1280) and `mobile-webkit`
 * (iPhone 14, 390); the phone tests also narrow to 320. `?preview=demo` supplies
 * the dataset, because the e2e job has no Supabase credentials.
 */

const TODAY = '/training-facility/weight-room?preview=demo'

/** Tailwind's `lg`, where the page switches between the two layouts. */
const LG_BREAKPOINT = 1024

/** The page's side gutter below `lg`, in CSS pixels. */
const GUTTER = 16

/** Smallest goal-name text accepted as readable on a phone, in CSS pixels. */
const MIN_FONT_PX = 14

test.describe('weight room Today layout', () => {
  for (const width of [390, 320]) {
    test(`states the board legibly at ${width}px`, async ({ page, viewport }) => {
      test.skip((viewport?.width ?? 0) >= LG_BREAKPOINT, 'phone layout only')
      await page.setViewportSize({ width, height: 844 })
      await page.goto(TODAY)

      const panel = page.getByTestId('today-progress-panel')
      await expect(panel).toBeVisible()
      const rows = panel.locator('li')
      // Guard: an empty list would pass every assertion below by measuring nothing.
      await expect(rows.first()).toBeVisible()

      // The longest name on the real board isn't in the demo data, so write it
      // in. Wait for hydration first: React would restore a pre-hydration edit,
      // and the measurements below would pass on the short name.
      await page.waitForFunction(() => {
        const nav = document.querySelector('[data-testid="weight-room-sub-nav"]')
        return nav !== null && Object.keys(nav).some(key => key.startsWith('__reactFiber'))
      })
      const longName = 'Single Leg Romanian Deadlift'
      await rows
        .first()
        .locator('span.break-words')
        .evaluate((name, text) => {
          name.textContent = text
        }, longName)
      await expect(rows.first()).toContainText(longName)

      const measured = await rows.evaluateAll(items =>
        items.map(item => {
          const name = item.querySelector<HTMLElement>('span.break-words')!
          const box = item.getBoundingClientRect()
          const nameBox = name.getBoundingClientRect()
          const count = item.lastElementChild!.getBoundingClientRect()
          return {
            text: item.textContent,
            top: box.top,
            bottom: box.bottom,
            right: box.right,
            fontPx: parseFloat(getComputedStyle(name).fontSize),
            nameRight: nameBox.right,
            countLeft: count.left,
          }
        })
      )

      for (const [i, row] of measured.entries()) {
        expect(row.text).toMatch(/\d+ \/ \d+/)
        expect(row.fontPx).toBeGreaterThanOrEqual(MIN_FONT_PX)
        expect(row.right).toBeLessThanOrEqual(width - GUTTER)
        expect(row.nameRight).toBeLessThanOrEqual(row.countLeft)
        if (i > 0) expect(row.top).toBeGreaterThanOrEqual(measured[i - 1].bottom - 1)
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      expect(overflow).toBe(0)
    })

    test(`keeps a page gutter on the sub-nav at ${width}px`, async ({ page, viewport }) => {
      test.skip((viewport?.width ?? 0) >= LG_BREAKPOINT, 'phone layout only')
      await page.setViewportSize({ width, height: 844 })
      await page.goto(TODAY)

      const box = await page.getByTestId('weight-room-sub-nav').boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(GUTTER)
    })
  }

  test('hides the unreadable wall tallies on a phone and shows them on desktop', async ({
    page,
    viewport,
  }) => {
    await page.goto(TODAY)
    await expect(page.locator('[data-testid^="wall-ring-"]').first()).toBeAttached()
    const tally = page.getByTestId('wall-tally-pushups')

    if ((viewport?.width ?? 0) < LG_BREAKPOINT) {
      await expect(tally).toBeHidden()
    } else {
      await expect(tally).toBeVisible()
      // Out of the visual layout, but still in the accessibility tree because the
      // wall is `aria-hidden`.
      const panel = page.getByTestId('today-progress-panel')
      await expect(panel).toBeAttached()
      expect((await panel.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1)
      await expect(page.getByRole('region', { name: "Today's progress" })).toBeAttached()
    }
  })

  test('keeps the desktop page to one screen', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < LG_BREAKPOINT, 'desktop layout only')
    await page.goto(TODAY)
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight
    )
    expect(scrollable).toBe(0)
  })
})
