import { expect, test, type Page } from '@playwright/test'

import {
  ADMIN_BASE_URL,
  fakeState,
  resetFakeSupabase,
  signInAsE2eAdmin,
  waitForHydration,
  type FakeRow,
} from './helpers/admin'

/**
 * The Weight Room log, used the way it mostly is: as the admin, on a phone,
 * by tapping. Runs in `mobile-webkit` (iPhone 14, 390px, touch) against
 * the admin server, where the e2e admin stub supplies the session and every
 * read and write goes to the in-memory Supabase fake. Nothing here can reach a
 * real project: the stub refuses to activate unless Supabase is on loopback.
 *
 * Each test starts from the fake's seed and checks both what the page shows
 * and what was actually written, since a list that re-renders optimistically
 * can look right while the write failed.
 */

test.use({ baseURL: ADMIN_BASE_URL })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const LOG = '/training-facility/weight-room/log'

/** Seeded template and slot ids, from `e2e/fake-supabase/seed.json`. */
const TEMPLATE_NAME = 'E2E Upper Pull'
const PULLUP_SLOT_ID = '7a1f0c3e-4b2d-4e8a-9c61-0d5b2f3a1e11'

test.beforeEach(async ({ context }) => {
  await resetFakeSupabase()
  await signInAsE2eAdmin(context)
})

/** Open the log as the admin and wait until its controls respond to taps. */
async function openLog(page: Page): Promise<void> {
  const response = await page.goto(LOG)
  expect(response?.status(), 'the log should render for the stubbed admin').toBe(200)
  await expect(page.getByRole('heading', { name: 'Log a set' })).toBeVisible()
  // The data island reads client-side; a cold dev server compiles it on first hit.
  await expect(page.getByTestId('quick-log')).toBeVisible({ timeout: 30_000 })
  await waitForHydration(page, '[data-testid="quick-log"]')
}

/** The fake's rows for one table. */
async function rows(table: string): Promise<FakeRow[]> {
  return (await fakeState())[table] ?? []
}

test('logs a set with one tap, then deletes it', async ({ page }) => {
  await openLog(page)

  await page.getByTestId('quick-log-pullups-5').tap()

  await expect
    .poll(async () => (await rows('weight_room_sets')).filter(s => s.exercise === 'pullups'))
    .toHaveLength(1)
  const [logged] = (await rows('weight_room_sets')).filter(s => s.exercise === 'pullups')
  expect(logged).toMatchObject({ reps: 5, workout_id: null })

  const row = page.getByTestId(`set-row-${logged.id as string}`)
  await expect(row).toBeVisible()
  await expect(row).toContainText('5')

  // Delete asks for confirmation; WebKit needs the dialog accepted explicitly.
  page.once('dialog', dialog => void dialog.accept())
  await row.getByRole('button', { name: /^Delete set of 5/ }).tap()

  await expect(row).toHaveCount(0)
  // Polled: a list that drops the row before the DELETE lands would otherwise
  // race the state read.
  await expect
    .poll(async () => (await rows('weight_room_sets')).some(s => s.id === logged.id))
    .toBe(false)
  // The seeded set from another day is untouched.
  await expect.poll(async () => (await rows('weight_room_sets')).length).toBe(1)
})

test('starts a workout from a template, logs into it, and ends it', async ({ page }) => {
  await openLog(page)

  const start = page.getByRole('region', { name: 'Start a workout' })
  await expect(start).toBeVisible()
  await start.locator('select').selectOption({ label: TEMPLATE_NAME })
  await start.getByRole('button', { name: 'Start' }).tap()

  const live = page.getByRole('region', { name: 'Live workout' })
  await expect(live).toBeVisible()
  await expect(live).toContainText(TEMPLATE_NAME)

  await expect.poll(async () => (await rows('weight_room_workouts')).length).toBe(1)
  const [workout] = await rows('weight_room_workouts')
  expect(workout).toMatchObject({ ended_at: null, location: 'gym' })
  expect(workout.template_id).toBeTruthy()

  // Log one set against the template's first slot (pull-ups, 5 prescribed).
  const slot = live
    .locator('li')
    .filter({ hasText: /pull-ups/i })
    .first()
  await expect(slot).toBeVisible()
  await slot.locator('input[inputmode="numeric"]').fill('5')
  await slot.getByRole('button', { name: 'Log set' }).tap()

  await expect
    .poll(async () => (await rows('weight_room_sets')).filter(s => s.workout_id === workout.id))
    .toHaveLength(1)
  const [inWorkout] = (await rows('weight_room_sets')).filter(s => s.workout_id === workout.id)
  expect(inWorkout).toMatchObject({
    exercise: 'pullups',
    reps: 5,
    template_slot_id: PULLUP_SLOT_ID,
  })
  await expect(live).toContainText('1 set')

  await live.getByRole('button', { name: 'End' }).tap()

  // Ending lands on the session's summary, and only after the write succeeded.
  await page.waitForURL(new RegExp(`/training-facility/weight-room/workouts/${workout.id}$`))
  const [ended] = await rows('weight_room_workouts')
  expect(ended.ended_at).toEqual(expect.any(String))
})
