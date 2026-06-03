import { expect, test } from '@playwright/test'

/**
 * The project binder's shared-element morph: clicking a card opens a detail
 * overlay (linked to the card by a Framer Motion `layoutId`), which can be
 * dismissed by Escape, the close button, or a backdrop click. These specs
 * assert the open/close interaction, not the visual morph itself.
 */
test.describe('project detail overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByTestId('projects-title')).toBeVisible()
  })

  test('opens the detail overlay when a card is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /open courtfolio details/i }).click()

    const detail = page.getByTestId('project-detail')
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('heading', { name: 'Courtfolio' })).toBeVisible()
    await expect(detail.getByRole('link', { name: /view project/i })).toBeVisible()
  })

  test('closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: /open courtfolio details/i }).click()
    await expect(page.getByTestId('project-detail')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('project-detail')).toHaveCount(0)
  })

  test('closes on the close button', async ({ page }) => {
    await page.getByRole('button', { name: /open courtfolio details/i }).click()
    await expect(page.getByTestId('project-detail')).toBeVisible()

    await page.getByRole('button', { name: /close project details/i }).click()
    await expect(page.getByTestId('project-detail')).toHaveCount(0)
  })
})
