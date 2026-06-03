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

  test('is keyboard operable and restores focus to the card on close', async ({ page }) => {
    const card = page.getByRole('button', { name: /open courtfolio details/i })

    // The card's open target is a real (stretched) button; Enter activates it.
    await card.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('project-detail')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('project-detail')).toHaveCount(0)
    // Focus returns to the triggering card, not the document body.
    await expect(card).toBeFocused()
  })
})

/**
 * Each project with an EXTERNAL href keeps a real `<a>` on its gallery card —
 * crawlable and middle/ctrl-clickable — distinct from the card's open-detail
 * button. Internal-href projects (e.g. Courtfolio → "/") do not get one.
 */
test.describe('project gallery outbound links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByTestId('projects-title')).toBeVisible()
  })

  test('renders a crawlable external link on cards with an external href', async ({ page }) => {
    const link = page.getByRole('link', { name: /view bars of the day project/i })
    await expect(link).toHaveAttribute('href', 'https://barsoftheday.com')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  })

  test('omits the outbound link for internal-href projects', async ({ page }) => {
    // Courtfolio's href is "/", so no outbound anchor — only its open-detail button.
    await expect(page.getByRole('link', { name: /view courtfolio project/i })).toHaveCount(0)
  })
})

/**
 * While the detail dialog is open, the gallery grid behind the backdrop is
 * marked `inert` so keyboard/AT users can't reach the obscured cards.
 */
test.describe('project detail overlay — background inertness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByTestId('projects-title')).toBeVisible()
  })

  test('toggles inert on the gallery grid with the dialog', async ({ page }) => {
    const gallery = page.getByTestId('gallery-content')
    expect(await gallery.getAttribute('inert')).toBeNull()

    await page.getByRole('button', { name: /open courtfolio details/i }).click()
    await expect(page.getByTestId('project-detail')).toBeVisible()
    expect(await gallery.getAttribute('inert')).toBe('')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('project-detail')).toHaveCount(0)
    expect(await gallery.getAttribute('inert')).toBeNull()
  })
})
