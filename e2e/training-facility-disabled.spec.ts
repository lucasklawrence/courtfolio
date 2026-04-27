import { expect, test } from '@playwright/test'

import { bypassHomeIntro } from './helpers/intro'

/** Routes that should continue to render the custom 404 while the feature flag is off. */
const gatedRoutes = ['/training-facility', '/training-facility/gym', '/training-facility/combine']

test.describe('training facility disabled', () => {
  test.beforeEach(async ({ page }) => {
    await bypassHomeIntro(page)
  })

  test('does not expose the home-court entrance when the flag is off', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: /enter the training facility/i })).toHaveCount(0)
  })

  for (const route of gatedRoutes) {
    test(`renders the custom 404 for ${route}`, async ({ page }) => {
      await page.goto(route)

      await expect(page.getByText('AIRBALL.')).toBeVisible()
      await expect(page.getByText(route)).toBeVisible()
      await expect(page.getByRole('link', { name: /back to home court/i })).toBeVisible()
    })
  }
})
