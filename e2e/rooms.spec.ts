import { expect, test, type Locator, type Page } from '@playwright/test'

type RoomExpectation = {
  route: string
  locator: (page: Page) => Locator
  backLinkName: RegExp
}

const roomExpectations: RoomExpectation[] = [
  {
    route: '/locker-room',
    locator: page => page.getByRole('heading', { name: /locker room - select an item to get more info/i }),
    backLinkName: /back to home court/i,
  },
  {
    route: '/projects',
    locator: page => page.getByText(/tech stack binder/i),
    backLinkName: /back to home court/i,
  },
  {
    route: '/contact',
    locator: page => page.getByRole('heading', { name: /scouting inquiry/i }),
    backLinkName: /back to home court/i,
  },
  {
    route: '/banners',
    locator: page => page.getByRole('heading', { name: /the rafters/i }),
    backLinkName: /back to the court/i,
  },
]

test.describe('room routes', () => {
  for (const { route, locator, backLinkName } of roomExpectations) {
    test(`renders ${route}`, async ({ page }) => {
      await page.goto(route)

      await expect(locator(page)).toBeVisible()
      await expect(page.getByRole('link', { name: backLinkName })).toBeVisible()
    })
  }

  test('contact page exposes the resume affordance', async ({ page }) => {
    await page.goto('/contact')

    await expect(page.getByRole('link', { name: /view full resume \(pdf\)/i })).toBeVisible()
  })
})
