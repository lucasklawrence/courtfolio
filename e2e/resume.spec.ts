import { expect, test } from '@playwright/test'

/**
 * Smoke coverage for the resume download route (#220 / #227). The PDF
 * itself is a static asset; `/resume` exists purely so the server can
 * count downloads before redirecting. These tests pin the redirect
 * contract and that the user-facing link actually routes through it —
 * a link pointed back at the bare PDF would silently stop counting.
 */

test.describe('resume download route', () => {
  test('GET /resume 307-redirects to the static PDF', async ({ request }) => {
    const res = await request.get('/resume', { maxRedirects: 0 })

    expect(res.status()).toBe(307)
    // Location may come back absolute; compare the path only.
    expect(new URL(res.headers()['location']).pathname).toBe('/LucasLawrenceResume.pdf')
  })

  test('the contact-page resume link routes through /resume', async ({ page }) => {
    await page.goto('/contact')

    await expect(
      page.getByRole('link', { name: /view full resume \(pdf\)/i }),
    ).toHaveAttribute('href', '/resume')
  })
})
