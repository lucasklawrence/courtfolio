import { expect, type BrowserContext, type Page } from '@playwright/test'

/**
 * Shared setup for the admin e2e specs.
 *
 * The admin server (`npm run e2e:dev:admin`) runs with the e2e admin stub on
 * and every Supabase client pointed at the in-memory fake
 * (`e2e/fake-supabase/server.mjs`). A spec opts in with
 * `test.use({ baseURL: ADMIN_BASE_URL })`, asks for the admin session with
 * {@link signInAsE2eAdmin}, and starts each test from the seed with
 * {@link resetFakeSupabase}.
 */

import { ADMIN_BASE_URL, E2E_ADMIN_COOKIE_NAME, FAKE_SUPABASE_URL } from './admin-constants'

export { ADMIN_BASE_URL, E2E_ADMIN_COOKIE_NAME, FAKE_SUPABASE_URL }

/** One row of the fake's tables, as returned by `GET /__state`. */
export type FakeRow = Record<string, unknown>

/**
 * Set the stub cookie for a host, so its requests carry the admin session.
 *
 * @param context The test's browser context.
 * @param baseUrl The server to sign in to; defaults to the admin server.
 */
export async function signInAsE2eAdmin(
  context: BrowserContext,
  baseUrl: string = ADMIN_BASE_URL
): Promise<void> {
  await context.addCookies([{ name: E2E_ADMIN_COOKIE_NAME, value: '1', url: baseUrl }])
}

/** Restore the fake's seed data, so a test never sees another test's writes. */
export async function resetFakeSupabase(): Promise<void> {
  const res = await fetch(`${FAKE_SUPABASE_URL}/__reset`, { method: 'POST' })
  expect(res.ok, 'the Supabase fake did not reset').toBe(true)
}

/**
 * Every table in the fake, for asserting what a flow actually wrote.
 *
 * @returns table name → rows.
 */
export async function fakeState(): Promise<Record<string, FakeRow[]>> {
  const res = await fetch(`${FAKE_SUPABASE_URL}/__state`)
  expect(res.ok, 'the Supabase fake did not return its state').toBe(true)
  return (await res.json()) as Record<string, FakeRow[]>
}

/**
 * Wait until React has hydrated the page. A tap before hydration hits an inert
 * server-rendered button and silently does nothing.
 *
 * @param page The page under test.
 * @param selector A client component's root that only gets a fiber once hydrated.
 */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(sel => {
    const el = document.querySelector(sel)
    return el !== null && Object.keys(el).some(key => key.startsWith('__reactFiber'))
  }, selector)
}
