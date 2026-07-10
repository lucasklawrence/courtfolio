import { expect, test } from '@playwright/test'

/**
 * The Draft Room's LIVE mode (#241): with `NEXT_PUBLIC_ENABLE_PANEL_LIVE=true`
 * and `PANEL_LIVE_STUB=1` (this server's config), the "Run it live" button
 * streams a stubbed run through the real NDJSON wire protocol — the exact
 * event sequence a paid run emits, produced by the same `resultToEvents`
 * helper the cache-replay path uses, with zero model calls.
 *
 * These specs assert the streaming lifecycle a visitor sees: replay → run
 * button → cards fill as verdict events arrive → the fact-checker's rulings
 * land on the cards → the synthesis (map, overruled claims, verdict) arrives
 * last.
 */
test.describe('draft room live mode (stubbed stream)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/draft-room')
  })

  test('shows the replay plus the run-it-live controls before any run', async ({ page }) => {
    await expect(page.getByRole('button', { name: /run it live/i })).toBeVisible()
    // The stored replay is still the page body.
    await expect(page.getByRole('heading', { name: /grades the prospect/i })).toBeVisible()
    await expect(page.getByRole('region', { name: /panelist verdicts/i })).toBeVisible()
  })

  test('streams a run: cards fill, rulings land, synthesis arrives last', async ({ page }) => {
    await page.getByRole('button', { name: /run it live/i }).click()

    // The stream announces itself and the button locks while deliberating.
    await expect(page.getByRole('button', { name: /panel deliberating/i })).toBeDisabled()

    // All three persona cards fill in (stub paces events, so these appear
    // progressively; the assertions just wait for each).
    const verdicts = page.getByRole('region', { name: /panelist verdicts/i })
    await expect(verdicts.getByRole('heading', { name: 'Skeptical Hiring Manager' })).toBeVisible()
    await expect(verdicts.getByRole('heading', { name: 'Staff-Engineer Mentor' })).toBeVisible()
    await expect(verdicts.getByRole('heading', { name: 'Skeptical Peer' })).toBeVisible()

    // The fact-checker's per-gap rulings land on the finished cards.
    await expect(verdicts.getByText(/upheld|overruled|unverifiable/).first()).toBeVisible()

    // The synthesis arrives last: map, overruled claims, verdict.
    await expect(page.getByRole('heading', { name: /where they split/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /overruled panel claims/i })).toBeVisible()
    await expect(page.getByText('The verdict')).toBeVisible()

    // Terminal state: the button unlocks for another run.
    await expect(page.getByRole('button', { name: /run it live/i })).toBeEnabled()
  })

  test('keeps the why-no-debate note in the live layout', async ({ page }) => {
    await page.getByRole('button', { name: /run it live/i }).click()
    await expect(page.getByText(/why the panel doesn’t debate/i)).toBeVisible()
  })
})
