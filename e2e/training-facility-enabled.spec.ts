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

  test('renders the corridor lobby with all three doors active', async ({ page }) => {
    await page.goto('/training-facility')

    // Scene-first layout (#326): the h1 is visually hidden but present for
    // screen readers + this assertion; wayfinding lives on the door signs.
    await expect(page.getByRole('heading', { name: /^training facility$/i })).toBeAttached()
    // The three doorways are SVG anchors — assert on the DOM href/aria so
    // the check doesn't depend on SVG bounding-box visibility.
    await expect(page.locator('a[href="/training-facility/gym"]')).toHaveCount(1)
    await expect(page.locator('a[href="/training-facility/combine"]')).toHaveCount(1)
    await expect(page.locator('a[href="/training-facility/weight-room"]')).toHaveCount(1)
  })

  test('renders the gym and combine placeholder routes', async ({ page }) => {
    await page.goto('/training-facility/gym')
    // Heading is visually hidden in the scene-first layout (#197) but
    // remains in the DOM for screen readers + this assertion.
    await expect(page.getByRole('heading', { name: /^the gym$/i })).toBeAttached()
    await expect(
      page.getByRole('link', { name: /^← training facility$/i }),
    ).toBeVisible()

    await page.goto('/training-facility/combine')
    await expect(page.getByRole('heading', { name: /^the combine$/i })).toBeAttached()
    await expect(
      page.getByRole('link', { name: /^← training facility$/i }),
    ).toBeVisible()
  })

  test('renders the weight room Today View when reached directly', async ({ page }) => {
    await page.goto('/training-facility/weight-room')
    // Heading is visually hidden in the scene-first layout (#197) but
    // remains in the DOM for screen readers + this assertion.
    await expect(page.getByRole('heading', { name: /^today$/i })).toBeAttached()
    // Sub-nav presence (#82) — assertions on individual pills proved
    // flaky on CI even with href-only checks (the Today client
    // island's hydration intermittently detaches the surrounding
    // <nav>'s descendants from the DOM right when Playwright queries).
    // The nav element being visible is enough at the e2e level; pill
    // wiring is covered exhaustively in `WeightRoomSubNav.test.tsx`.
    const subNav = page.getByRole('navigation', { name: 'Weight Room sections' })
    await expect(subNav).toBeVisible()
  })

  test('the Weight Room door in the corridor points to the Today View', async ({ page }) => {
    await page.goto('/training-facility')
    const door = page.locator('a[aria-label="Enter the Weight Room"]')
    await expect(door).toHaveAttribute('href', '/training-facility/weight-room')
  })
})
