import { expect, test } from '@playwright/test'

/**
 * The Draft Room (#234 Phase 2 / #241) is a pre-baked panel showcase: it replays
 * a stored result with an animated reveal and makes no model calls. These specs
 * assert the page renders its key surfaces — the thesis, independent persona
 * verdicts, the disagreement map, the overruled-claims catch, and the verdict —
 * in a real browser (where the reveal animation and matchMedia work).
 */
test.describe('draft room showcase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/draft-room')
  })

  test('renders the heading and the thesis under test', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /grades the prospect/i })).toBeVisible()
    await expect(page.getByText('The thesis under test')).toBeVisible()
  })

  test('shows independent persona verdicts with grounded citations', async ({ page }) => {
    const verdicts = page.getByRole('region', { name: /panelist verdicts/i })
    await expect(verdicts.getByRole('heading', { name: 'Skeptical Hiring Manager' })).toBeVisible()
    await expect(verdicts.getByRole('heading', { name: 'Staff-Engineer Mentor' })).toBeVisible()
    await expect(verdicts.getByRole('heading', { name: 'Skeptical Peer' })).toBeVisible()
    // A gap cites real source.
    await expect(verdicts.getByText('components/court/FreeRoamPlayer.tsx').first()).toBeVisible()
  })

  test('surfaces the disagreement as the honest signal', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /where they split/i })).toBeVisible()
    await expect(page.getByText(/help or hurt the portfolio signal/i)).toBeVisible()
  })

  test('shows the verifier’s overruled claims and the final verdict', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /overruled panel claims/i })).toBeVisible()
    await expect(page.getByText('The verdict')).toBeVisible()
  })

  test('explains why the panel does not debate', async ({ page }) => {
    await expect(page.getByText(/why the panel doesn’t debate/i)).toBeVisible()
  })
})
