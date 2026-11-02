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
 * The browser and the server are both in UTC, the server through the `e2e:dev` scripts.
 * A server started any other way keeps its own zone, which can change the result. A gap
 * between the zones would make a date-related mismatch appear only for the hours when
 * they're on different calendar days, which `test.fail()` can't express.
 *
 * Each route is one test and one page load. Anything other than a route's known
 * offender fails it outright. Only then is the test marked with `test.fail()`, so a
 * known failure can't hide a new one. When the fix lands the test starts passing,
 * Playwright reports that as a failure, and the entry has to go.
 *
 * `?preview=demo` supplies data where a route supports it, because the e2e job has no
 * Supabase credentials. Pages with little data render little, so this doesn't catch a
 * mismatch that only real data reaches.
 */

/**
 * Public routes, with `?preview=demo` where the page reads it.
 *
 * Not here: `/training-facility` and `/training-facility/combine`, whose flag is off on
 * every e2e server, and the Weight Room's `log` and `settings`, which return 404 to
 * anyone but the admin. Other dynamic routes need an id that resolves both on CI's demo
 * data and on a local run's real data, so `exercises/pullups` stands in for them.
 */
const ROUTES = [
  '/',
  '/projects',
  '/contact',
  '/locker-room',
  '/draft-room',
  '/banners',
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
const HYDRATION_TIMEOUT_MS = 45_000

/** Long enough after hydration starts for React to finish and report any mismatch. */
const HYDRATION_SETTLE_MS = 1_500

/** One sub-pixel of slack for layout rounding, as `chart-overflow.spec.ts` allows. */
const OVERFLOW_SLACK_PX = 1

/** iOS zooms the page when a focused field's text is smaller than this. */
const MIN_FIELD_FONT_PX = 16

/** What one page load found, in the form a failed assertion should print. */
interface Findings {
  /** Uncaught errors and hydration reports, in the order they happened. */
  pageErrors: string[]
  /** Empty, or how far the document scrolls sideways and what sticks out. */
  sidewaysOverflow: string[]
  /** Text fields below {@link MIN_FIELD_FONT_PX}, with their computed size. */
  smallFields: string[]
}

/** A problem that exists on `main` today, and the issue that fixes it. */
interface KnownFailure {
  /** The check that fails. */
  check: keyof Findings
  /** Matches the findings this entry excuses. Any other finding still fails the test. */
  offender: RegExp
  /** Issue link shown in the report. */
  issue: string
}

/** The `/contact` hydration error, among others. */
const HYDRATION_ISSUE = 'https://github.com/lucasklawrence/courtfolio/issues/485'
/** The date range's 12px fields, among other touch and zoom problems. */
const MOBILE_POLISH_ISSUE = 'https://github.com/lucasklawrence/courtfolio/issues/486'

/** The date range's fields. */
const SMALL_DATE_FIELDS: KnownFailure = {
  check: 'smallFields',
  offender: /"(?:Start|End) date"/,
  issue: MOBILE_POLISH_ISSUE,
}

/** Everything that fails on `main`, measured without Supabase credentials as CI runs. */
const KNOWN_FAILURES: Partial<Record<(typeof ROUTES)[number], KnownFailure>> = {
  '/contact': { check: 'pageErrors', offender: /^Hydration failed/, issue: HYDRATION_ISSUE },
  '/training-facility/gym/overview?preview=demo': SMALL_DATE_FIELDS,
  '/training-facility/gym/treadmill?preview=demo': SMALL_DATE_FIELDS,
  '/training-facility/gym/stair?preview=demo': SMALL_DATE_FIELDS,
  '/training-facility/gym/track?preview=demo': SMALL_DATE_FIELDS,
  '/training-facility/gym/otf': SMALL_DATE_FIELDS,
}

/**
 * Failures only real data reaches, so they show on a local run with credentials and
 * never on CI. `test.fail()` needs a failure on every run, so these are excused instead.
 */
const REAL_DATA_FAILURES: Partial<Record<(typeof ROUTES)[number], KnownFailure>> = {
  '/training-facility/gym/otf': {
    check: 'pageErrors',
    offender: /^A tree hydrated/,
    issue: HYDRATION_ISSUE,
  },
}

/** Load a route, fail on a bad status, and measure everything once it has hydrated. */
async function loadAndMeasure(page: Page, route: string): Promise<Findings> {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message.slice(0, 600)))
  page.on('console', message => {
    if (message.type() !== 'error') return
    // Other console errors, such as a failed fetch with no credentials, aren't crashes.
    const text = message.text()
    if (/hydrat/i.test(text)) pageErrors.push(text.slice(0, 600))
  })

  const response = await page.goto(route, { waitUntil: 'load' })
  // A 404 page would otherwise pass all three checks by measuring nothing.
  expect(response?.status(), `${route} should load`).toBeLessThan(400)
  // React's internal key is the only sign it has reached the DOM. Failing here beats
  // measuring a page that hasn't hydrated, which would pass by not having looked.
  await page.waitForFunction(
    () => {
      const root = document.querySelector('main') ?? document.body
      return Object.keys(root).some(key => key.startsWith('__reactFiber$'))
    },
    undefined,
    { timeout: HYDRATION_TIMEOUT_MS }
  )
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
      const sidewaysOverflow: string[] = []
      if (excess > slack) {
        sidewaysOverflow.push(`document scrolls ${excess}px sideways`)
        for (const el of document.querySelectorAll('body *')) {
          const right = el.getBoundingClientRect().right
          if (right > doc.clientWidth + slack && !clipped(el) && sidewaysOverflow.length <= 3) {
            const name = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '')}`
            sidewaysOverflow.push(`${name.slice(0, 60)} ends at ${Math.round(right)}px`)
          }
        }
      }

      // Tapping these doesn't focus a text caret, so iOS doesn't zoom for them.
      const noZoom = /^(hidden|checkbox|radio|range|file|color|button|submit|reset|image)$/
      const smallFields: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>('input, select, textarea')) {
        if (el instanceof HTMLInputElement && noZoom.test(el.type)) continue
        const size = parseFloat(getComputedStyle(el).fontSize)
        const shown = el.getBoundingClientRect().width > 0
        if (shown && size < minFont) {
          const name = el.getAttribute('name') ?? el.getAttribute('aria-label') ?? el.id
          smallFields.push(`${el.tagName.toLowerCase()} "${name}" is ${size}px`)
        }
      }
      return { sidewaysOverflow, smallFields }
    },
    { slack: OVERFLOW_SLACK_PX, minFont: MIN_FIELD_FONT_PX }
  )

  return { pageErrors, ...measured }
}

test.describe.configure({ timeout: 120_000 })
test.use({ timezoneId: 'UTC' })

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    for (const route of ROUTES) {
      test(`${route} has no new problems`, async ({ page }) => {
        const findings = await loadAndMeasure(page, route)
        const known = KNOWN_FAILURES[route]

        const excused = known ? findings[known.check].filter(f => known.offender.test(f)) : []
        const unexpected = { ...findings }
        for (const failure of [known, REAL_DATA_FAILURES[route]]) {
          if (!failure) continue
          unexpected[failure.check] = unexpected[failure.check].filter(
            finding => !failure.offender.test(finding)
          )
        }
        expect(unexpected).toEqual({ pageErrors: [], sidewaysOverflow: [], smallFields: [] })

        if (known) {
          // Marked only now, so everything above still fails for real.
          test.fail(true, known.issue)
          expect(excused).toEqual([])
        }
      })
    }
  })
}
