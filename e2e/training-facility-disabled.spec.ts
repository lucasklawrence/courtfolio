import { expect, test } from '@playwright/test'

import { bypassHomeIntro } from './helpers/intro'

/**
 * Runs against the all-flags-off server, which is production's current state.
 *
 * Since the flag split (#345) this file owns the dark-route coverage for every
 * area, including the tracking hub — the sibling `-enabled` spec now runs the
 * *shipping* combination (Gym and Weight Room live, lobby and Combine dark)
 * rather than an everything-on state no environment uses.
 */
const gatedRoutes = [
  '/training-facility',
  '/training-facility/tracking',
  '/training-facility/gym',
  '/training-facility/gym/otf',
  '/training-facility/combine',
  '/training-facility/weight-room',
  '/training-facility/weight-room/achievements',
  '/training-facility/weight-room/history',
]

test.describe('training facility disabled', () => {
  test.beforeEach(async ({ page }) => {
    await bypassHomeIntro(page)
  })

  test('does not expose the home-court entrance when the flag is off', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: /enter the training facility/i })).toHaveCount(0)
  })

  test('does not advertise the tracking project in the binder', async ({ page }) => {
    // The card's only destination is the hub, which 404s here — a project card
    // into a dead route is the binder equivalent of a door into a wall.
    await page.goto('/projects')
    await expect(page.getByRole('button', { name: /open training facility details/i })).toHaveCount(
      0
    )
  })

  for (const route of gatedRoutes) {
    test(`renders the custom 404 for ${route}`, async ({ page }) => {
      await page.goto(route)

      await expect(page.getByText('AIRBALL.')).toBeVisible()
      await expect(page.getByText(route)).toBeVisible()
      await expect(page.getByRole('link', { name: /home court/i })).toBeVisible()
    })
  }
})
