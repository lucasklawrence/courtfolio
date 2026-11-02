import { expect, test, type Page } from '@playwright/test'

/**
 * Loads every public route at phone widths and checks the three things a one-off
 * sweep once found broken and nothing else looked at: uncaught page errors including
 * React hydration errors, sideways page scrolling, and fields small enough that iOS
 * zooms the page when one is focused.
 *
 * Runs only in `mobile-webkit`, against the server with the Training Facility flags
 * on, so the flag-gated routes render instead of returning 404. WebKit on Linux isn't
 * iOS Safari, so this is a partial proxy for a real phone.
 *
 * The `e2e:dev` scripts pin the server to UTC, as production runs, and the browser is
 * in Pacific, as the site's real viewer is. Without that gap a date rendered through
 * the runtime's clock matches by accident.
 *
 * A known failure gets a test of its own, marked with `test.fail()` and a link to its
 * fix issue, so it can't hide a new failure on the same route. When the fix lands that
 * test starts passing, Playwright reports it as a failure, and its entry here has to
 * go. `?preview=demo` supplies data where a route supports it, because the e2e job has
 * no Supabase credentials.
 */

/**
 * Public routes, with `?preview=demo` where the page reads it.
 *
 * Not here: `/training-facility` and `/training-facility/combine`, whose flag is off on
 * every e2e server, and the Weight Room's `log` and `settings`, which return 404 to
 * anyone but the admin. Dynamic routes with no demo data need an id that CI can't
 * resolve, so `exercises/pullups` stands in for them.
 */
const ROUTES = [
  '/',
  '/projects',
  '/contact',
  '/locker-room',
  '/draft-room',
  '/training-facility/gym?preview=demo',
  '/training-facility/gym/overview?preview=demo',
  '/training-facility/gym/treadmill?preview=demo',
  '/training-facility/gym/stair?preview=demo',
  '/training-facility/gym/track?preview=demo',
  '/training-facility/gym/otf',
  '/training-facility/gym/zones',
  '/training-facility/tracking',
  '/training-facility/weight-room?preview=demo',
  '/training-facility/weight-room/history?preview=demo',
  '/training-facility/weight-room/workouts?preview=demo',
  '/training-facility/weight-room/program',
  '/training-facility/weight-room/eras?preview=demo',
  '/training-facility/weight-room/achievements',
  '/training-facility/weight-room/exercises/pullups?preview=demo',
] as const

/** The widths the spec loads each route at: iPhone 14, and the iPhone SE's narrower 320. */
const VIEWPORTS = [
  { width: 390, height: 664 },
  { width: 320, height: 568 },
] as const

/** How long to wait for a route's chunks, which compile on demand on a cold dev server. */
const NETWORK_IDLE_TIMEOUT_MS = 15_000

/** Long enough for React to finish hydrating and report any mismatch. */
const HYDRATION_SETTLE_MS = 1_500

/** One sub-pixel of slack for layout rounding, as `chart-overflow.spec.ts` allows. */
const OVERFLOW_SLACK_PX = 1

/** iOS zooms the page when a focused field's text is smaller than this. */
const MIN_FIELD_FONT_PX = 16

/** A check the spec runs on each route. */
type Check = 'page errors' | 'sideways overflow' | 'field font size'

/** A check that fails on `main` today, and the issue that fixes it. */
interface KnownFailure {
  /** A route from {@link ROUTES}. */
  route: (typeof ROUTES)[number]
  /** The check that fails there. */
  check: Check
  /** Issue link shown in the report when this runs. */
  issue: string
}

/** Hydration errors on `/contact` and the gym pages. */
const HYDRATION_ISSUE = 'https://github.com/lucasklawrence/courtfolio/issues/485'
/** The date range's 12px fields, among other touch and zoom problems. */
const MOBILE_POLISH_ISSUE = 'https://github.com/lucasklawrence/courtfolio/issues/486'

/** Everything that fails on `main` without Supabase credentials, which is how CI runs. */
const KNOWN_FAILURES: readonly KnownFailure[] = [
  { route: '/contact', check: 'page errors', issue: HYDRATION_ISSUE },
  ...(
    [
      '/training-facility/gym/overview?preview=demo',
      '/training-facility/gym/treadmill?preview=demo',
      '/training-facility/gym/stair?preview=demo',
      '/training-facility/gym/track?preview=demo',
      '/training-facility/gym/otf',
    ] as const
  ).map(route => ({ route, check: 'field font size' as const, issue: MOBILE_POLISH_ISSUE })),
]

/** What one page load found, in the form a failed assertion should print. */
interface Findings {
  /** Uncaught errors and hydration reports, in the order they happened. */
  'page errors': string[]
  /** Empty, or how far the document scrolls sideways and what sticks out. */
  'sideways overflow': string[]
  /** Text fields below {@link MIN_FIELD_FONT_PX}, with their computed size. */
  'field font size': string[]
}

/** Load a route, fail on a bad status, and measure everything once it has hydrated. */
async function loadAndMeasure(page: Page, route: string): Promise<Findings> {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message.slice(0, 600)))
  page.on('console', message => {
    if (message.type() !== 'error') return
    // Other console errors, such as a failed fetch with no credentials, aren't crashes.
    const text = message.text()
    if (/hydrat|Minified React error #4(18|23|25)/i.test(text)) errors.push(text.slice(0, 600))
  })

  const response = await page.goto(route, { waitUntil: 'load' })
  // A 404 page would otherwise pass all three checks by measuring nothing.
  expect(response?.status(), `${route} should load`).toBeLessThan(400)
  // Best effort. A page that keeps polling still gets measured.
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {})
  await page.waitForTimeout(HYDRATION_SETTLE_MS)

  const measured = await page.evaluate(
    ({ slack, minFont }) => {
      const doc = document.documentElement
      const excess = doc.scrollWidth - doc.clientWidth
      const clipped = (el: Element): boolean => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (p !== document.body && p !== doc && getComputedStyle(p).overflowX !== 'visible') {
            return true
          }
        }
        return false
      }
      const overflow: string[] = []
      if (excess > slack) {
        overflow.push(`document scrolls ${excess}px sideways`)
        for (const el of document.querySelectorAll('body *')) {
          const right = el.getBoundingClientRect().right
          if (right > doc.clientWidth + slack && !clipped(el) && overflow.length <= 3) {
            const name = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '')}`
            overflow.push(`${name.slice(0, 60)} ends at ${Math.round(right)}px`)
          }
        }
      }

      // Tapping these doesn't focus a text caret, so iOS doesn't zoom for them.
      const noZoom = /^(hidden|checkbox|radio|range|file|color|button|submit|reset|image)$/
      const fields: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>('input, select, textarea')) {
        if (el instanceof HTMLInputElement && noZoom.test(el.type)) continue
        const size = parseFloat(getComputedStyle(el).fontSize)
        const shown = el.getBoundingClientRect().width > 0
        if (shown && size < minFont) {
          const name = el.getAttribute('name') ?? el.getAttribute('aria-label') ?? el.id
          fields.push(`${el.tagName.toLowerCase()} "${name}" is ${size}px`)
        }
      }
      return { overflow, fields }
    },
    { slack: OVERFLOW_SLACK_PX, minFont: MIN_FIELD_FONT_PX }
  )

  return {
    'page errors': errors,
    'sideways overflow': measured.overflow,
    'field font size': measured.fields,
  }
}

const CHECKS: readonly Check[] = ['page errors', 'sideways overflow', 'field font size']

test.describe.configure({ timeout: 120_000 })
test.use({ timezoneId: 'America/Los_Angeles' })

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    for (const route of ROUTES) {
      const known = KNOWN_FAILURES.filter(failure => failure.route === route)
      const expectedToPass = CHECKS.filter(check => !known.some(k => k.check === check))

      test(`${route} loads with no problems`, async ({ page }) => {
        const findings = await loadAndMeasure(page, route)
        for (const check of expectedToPass) expect.soft(findings[check], check).toEqual([])
      })

      for (const { check, issue } of known) {
        test(`${route} has the known ${check} failure`, async ({ page }) => {
          const findings = await loadAndMeasure(page, route)
          // Marked after the load, so a route that stops loading still fails for real.
          test.fail(true, issue)
          expect(findings[check], check).toEqual([])
        })
      }
    }
  })
}

test('/resume hands over the PDF', async ({ request }) => {
  // A download, not a page, so the checks above don't apply to it.
  const response = await request.get('/resume')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/pdf')
})
