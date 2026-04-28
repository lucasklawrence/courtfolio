import { expect, test } from '@playwright/test'

import { bypassHomeIntro } from './helpers/intro'

test.describe('training facility enabled', () => {
  test.beforeEach(async ({ page }) => {
    await bypassHomeIntro(page)
  })

  test('shows the court-side entrance on the home page', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: /enter the training facility/i })).toBeVisible()
  })

  test('renders the top-level shell route', async ({ page }) => {
    await page.goto('/training-facility')

    await expect(page.getByRole('heading', { name: /pick a door\./i })).toBeVisible()
    await expect(page.getByRole('link', { name: /the gym/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /the combine/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /weight room/i })).toBeDisabled()
  })

  test('renders the gym and combine placeholder routes', async ({ page }) => {
    await page.goto('/training-facility/gym')
    await expect(page.getByRole('heading', { name: /^the gym$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to training facility/i })).toBeVisible()

    await page.goto('/training-facility/combine')
    await expect(page.getByRole('heading', { name: /^the combine$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to training facility/i })).toBeVisible()
  })
})
