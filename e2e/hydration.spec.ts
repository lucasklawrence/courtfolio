import { expect, test, type Page } from '@playwright/test'

/**
 * Pins that the routes in React's #418 reports hydrate cleanly, with the server and
 * browser in different timezones.
 *
 * `playwright.config.ts` pins the e2e server to UTC, as production runs. Pacific is
 * the site's real viewer.
 * Tokyo and Pago Pago put the browser on a calendar day either side of the server's
 * at any hour, which is what exposes a default of "today".
 *
 * Runs in `mobile-webkit` and `training-facility-enabled`, because `/contact` only
 * failed in WebKit. Without credentials these routes render with little data, and
 * the OTF page has no demo data at all, so `zone-render.test.tsx` covers the charts
 * and unit tests cover the date parsing that real data would reach.
 */

const ROUTES = [
  '/contact',
  '/training-facility/gym/otf',
  '/training-facility/gym/overview?preview=demo',
  '/training-facility/gym/treadmill?preview=demo',
  '/training-facility/gym/stair?preview=demo',
  '/training-facility/gym/track?preview=demo',
] as const

const ZONES = ['America/Los_Angeles', 'UTC', 'Asia/Tokyo', 'Pacific/Pago_Pago'] as const

/** The routes render slowly on a cold dev server. */
const LOAD_TIMEOUT = 60_000
/** Long enough for React to finish hydrating and report any mismatch. */
const HYDRATION_SETTLE_MS = 1_500

test.describe.configure({ timeout: 3 * LOAD_TIMEOUT })

/** Collect anything React reports about hydration while the page loads. */
function watchForHydrationErrors(page: Page): string[] {
  const errors: string[] = []
  const keep = (text: string) => {
    if (/hydrat|Minified React error #4(18|23|25)/i.test(text)) errors.push(text.slice(0, 600))
  }
  page.on('pageerror', error => keep(error.message))
  page.on('console', message => {
    if (message.type() === 'error') keep(message.text())
  })
  return errors
}

for (const timezoneId of ZONES) {
  test.describe(`browser in ${timezoneId}`, () => {
    test.use({ timezoneId })

    for (const route of ROUTES) {
      test(`${route} hydrates cleanly`, async ({ page }) => {
        const errors = watchForHydrationErrors(page)

        await page.goto(route, { waitUntil: 'load', timeout: LOAD_TIMEOUT })
        await expect(page.locator('main, h1').first()).toBeAttached({ timeout: LOAD_TIMEOUT })
        await page.waitForTimeout(HYDRATION_SETTLE_MS)

        expect(errors).toEqual([])
      })
    }
  })
}
