import { expect, test } from '@playwright/test'

/**
 * With the Draft Room feature flag off (the default), `/draft-room` must 404 via
 * the custom not-found page — same gate behavior as the Training Facility.
 */
test.describe('draft room disabled', () => {
  test('renders the custom 404 for /draft-room when the flag is off', async ({ page }) => {
    await page.goto('/draft-room')

    await expect(page.getByText('AIRBALL.')).toBeVisible()
    await expect(page.getByText('/draft-room')).toBeVisible()
    await expect(page.getByRole('link', { name: /home court/i })).toBeVisible()
  })
})
