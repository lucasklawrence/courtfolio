import { expect, test, type Locator, type Page } from '@playwright/test'

type RoomExpectation = {
  route: string
  locator: (page: Page) => Locator
}

/**
 * Every non-home room renders the shared `BackToCourtButton`, whose link text is
 * "🏀 Home Court". A single regex covers all four routes.
 */
const BACK_LINK_NAME = /home court/i

const roomExpectations: RoomExpectation[] = [
  {
    route: '/locker-room',
    locator: page => page.getByRole('heading', { name: /locker room - select an item to get more info/i }),
  },
  {
    route: '/projects',
    locator: page => page.getByTestId('projects-title'),
  },
  {
    route: '/contact',
    locator: page => page.getByRole('heading', { name: /scouting inquiry/i }),
  },
  {
    route: '/banners',
    locator: page => page.getByRole('heading', { name: /the rafters/i }),
  },
]

test.describe('room routes', () => {
  for (const { route, locator } of roomExpectations) {
    test(`renders ${route}`, async ({ page }) => {
      await page.goto(route)

      await expect(locator(page)).toBeVisible()
      await expect(page.getByRole('link', { name: BACK_LINK_NAME })).toBeVisible()
    })
  }

  test('contact page exposes the resume affordance', async ({ page }) => {
    await page.goto('/contact')

    await expect(page.getByRole('link', { name: /view full resume \(pdf\)/i })).toBeVisible()
  })
})
