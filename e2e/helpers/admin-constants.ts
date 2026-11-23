/**
 * Addresses and names shared by the admin e2e setup (#481). Kept free of any
 * Playwright import so `playwright.config.ts` and the Vitest guard test can
 * both read them.
 */

/** Base URL of the admin e2e server (`npm run e2e:dev:admin`). */
export const ADMIN_BASE_URL = 'http://127.0.0.1:3009'

/** The in-memory Supabase fake the admin server reads and writes. */
export const FAKE_SUPABASE_URL = 'http://127.0.0.1:54329'

/**
 * Cookie that asks the admin server for the stubbed session. Mirrors
 * `E2E_ADMIN_COOKIE` in `lib/auth/e2e-admin-stub.ts`, which can't be imported
 * here because it is `server-only`; `lib/auth/e2e-admin-stub.test.ts` asserts
 * the two match.
 */
export const E2E_ADMIN_COOKIE_NAME = 'cv-e2e-admin'
