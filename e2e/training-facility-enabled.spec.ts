import { expect, test } from '@playwright/test'

import { bypassHomeIntro } from './helpers/intro'

test.describe('training facility enabled', () => {
  test.beforeEach(async ({ page }) => {
    await bypassHomeIntro(page)
  })

  test('shows the court-side entrance on the home page', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: /enter the training facility/i })).toBeVisible()
  })

  test('renders the top-level shell route with all three doors active', async ({ page }) => {
    await page.goto('/training-facility')

    await expect(page.getByRole('heading', { name: /pick a door\./i })).toBeVisible()
    await expect(page.getByRole('link', { name: /the gym/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /the combine/i })).toBeVisible()
    // Slice #82 lights up Weight Room — was previously a disabled button.
    await expect(page.getByRole('link', { name: /weight room/i })).toBeVisible()
  })

  test('renders the gym and combine placeholder routes', async ({ page }) => {
    await page.goto('/training-facility/gym')
    await expect(page.getByRole('heading', { name: /^the gym$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to training facility/i })).toBeVisible()

    await page.goto('/training-facility/combine')
    await expect(page.getByRole('heading', { name: /^the combine$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to training facility/i })).toBeVisible()
  })

  test('renders the weight room Today View when reached directly', async ({ page }) => {
    await page.goto('/training-facility/weight-room')
    await expect(page.getByRole('heading', { name: /^today$/i })).toBeVisible()
    // Sub-nav (#82) exposes Today/History/Settings as links on every WR page.
    // Per-link href assertions live in the next test — they're more resilient
    // on CI than `toBeVisible` because `toHaveAttribute` doesn't run the
    // actionability check that the Today client island's hydration delay
    // sometimes blows past the 5s timeout for.
    const subNav = page.getByRole('navigation', { name: 'Weight Room sections' })
    await expect(subNav).toBeVisible()
  })

  test('the Weight Room sub-nav exposes History and Settings hrefs from the Today View', async ({
    page,
  }) => {
    // Asserts wiring without clicking — the click-based version was flaky
    // on CI because the Today client island's loading / animation state
    // kept Playwright's actionability check ("visible, enabled, stable")
    // from settling within the timeout. The unit tests in
    // `WeightRoomSubNav.test.tsx` cover the navigation behavior; this
    // test only proves the pills are present and routed correctly.
    await page.goto('/training-facility/weight-room')
    const subNav = page.getByRole('navigation', { name: 'Weight Room sections' })
    await expect(subNav.getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/training-facility/weight-room/history',
    )
    await expect(subNav.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/training-facility/weight-room/settings',
    )
  })

  test('the Weight Room door on the shell points to the Today View', async ({ page }) => {
    await page.goto('/training-facility')
    const door = page.getByRole('link', { name: /weight room/i })
    await expect(door).toBeVisible()
    await expect(door).toHaveAttribute('href', '/training-facility/weight-room')
  })
})
