import { expect, test } from '@playwright/test'

import { bypassHomeIntro } from './helpers/intro'

/**
 * Runs against the server configured to mirror the **shipping** flag state
 * (#345): Gym and Weight Room live, lobby and Combine dark. Before the flag
 * split this project ran with everything on, which tested a combination that
 * no environment actually uses — so a broken cross-area link looked fine here
 * and 404'd in production.
 *
 * The lobby / Combine assertions moved to `training-facility-disabled.spec.ts`,
 * which owns the dark-route coverage.
 */
test.describe('training facility — gym and weight room published', () => {
  test.beforeEach(async ({ page }) => {
    await bypassHomeIntro(page)
  })

  test('renders the tracking hub with a card per live area', async ({ page }) => {
    await page.goto('/training-facility/tracking')

    await expect(page.getByRole('heading', { name: /everything i train, logged/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /trophy room/i })).toHaveAttribute(
      'href',
      '/training-facility/weight-room/achievements'
    )
    await expect(page.getByRole('link', { name: /orangetheory/i })).toHaveAttribute(
      'href',
      '/training-facility/gym/otf'
    )
  })

  test('renders the gym scene without a door into the dark combine', async ({ page }) => {
    await page.goto('/training-facility/gym')
    // Heading is visually hidden in the scene-first layout (#197) but
    // remains in the DOM for screen readers + this assertion.
    await expect(page.getByRole('heading', { name: /^the gym$/i })).toBeAttached()
    // The Combine is dark, so its door must not be painted on the wall.
    await expect(page.getByRole('link', { name: /into the combine/i })).toHaveCount(0)
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

  test('renders the OrangeTheory dashboard server-side', async ({ page }) => {
    await page.goto('/training-facility/gym/otf')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('sub-pages link back to the tracking hub, not the dark lobby', async ({ page }) => {
    await page.goto('/training-facility/weight-room/achievements')
    const back = page.getByRole('link', { name: /^← tracking$/i })
    await expect(back).toBeVisible()
    await expect(back).toHaveAttribute('href', '/training-facility/tracking')
  })

  test('the projects binder offers the tracking card', async ({ page }) => {
    await page.goto('/projects')
    await expect(
      page.getByRole('button', { name: /open training facility details/i })
    ).toBeVisible()
  })
})
