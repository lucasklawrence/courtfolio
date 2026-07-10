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

  test('the live panel endpoint does not exist when its flag is off', async ({ request }) => {
    // The paid endpoint is gated by NEXT_PUBLIC_ENABLE_PANEL_LIVE (off on this
    // server): it must 404 like the page, not 429 or 500 (#241).
    const res = await request.post('/api/panel/run', { data: { targetId: 'courtfolio' } })
    expect(res.status()).toBe(404)
  })
})
