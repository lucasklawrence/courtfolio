import { expect, test } from '@playwright/test'

import { bypassHomeIntro, gotoHomeCourt } from './helpers/intro'

test.describe('home court', () => {
  test.beforeEach(async ({ page }) => {
    await bypassHomeIntro(page)
  })

  test('renders the primary navigation affordances', async ({ page }) => {
    await gotoHomeCourt(page)

    await expect(page.getByRole('button', { name: /view the rafters/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /enter locker room/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /view project binder/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /go to front office/i })).toBeVisible()
  })

  test('navigates from the home court into the locker room', async ({ page }) => {
    await gotoHomeCourt(page)

    await page.getByRole('button', { name: /enter locker room/i }).click()

    await expect(page).toHaveURL(/\/locker-room$/)
    await expect(
      page.getByRole('heading', { name: /locker room - select an item to get more info/i })
    ).toBeVisible()
  })
})
